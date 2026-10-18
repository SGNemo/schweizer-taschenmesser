//! A short reminder tone played by the native side, for the moment the web view cannot play it
//! (window hidden in the tray or covered by a game). The web side describes the tone (notes and
//! volume, see `core/notifications/sound.ts`); this module only validates, renders it as a small
//! in-memory WAV and plays it with `PlaySound`. Nothing is written to disk, nothing is received.

use serde::Deserialize;

const RATE: u32 = 22_050;
/// Hard limits: a reminder tone is a blip, never a melody.
const MAX_NOTES: usize = 8;
const MAX_TOTAL_MS: u32 = 2_500;
const MIN_HZ: f32 = 100.0;
const MAX_HZ: f32 = 4_000.0;
/// Fade in/out so the tone never clicks.
const FADE_MS: f32 = 8.0;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub hz: f32,
    /// Start in milliseconds from the beginning of the tone.
    pub at_ms: u32,
    pub dur_ms: u32,
    /// 0–1, relative loudness of this note.
    pub gain: f32,
}

/// Renders the notes as a 16-bit mono WAV file in memory. `None` for an empty or invalid request
/// (too many notes, too long, a frequency outside 100–4000 Hz, a non-finite number).
pub fn render_wav(notes: &[Note], volume: f32) -> Option<Vec<u8>> {
    if notes.is_empty() || notes.len() > MAX_NOTES || !volume.is_finite() {
        return None;
    }
    let volume = volume.clamp(0.0, 1.0);
    let mut end_ms = 0u32;
    for n in notes {
        let ok = n.hz.is_finite()
            && (MIN_HZ..=MAX_HZ).contains(&n.hz)
            && n.gain.is_finite()
            && n.dur_ms > 0;
        if !ok {
            return None;
        }
        end_ms = end_ms.max(n.at_ms.checked_add(n.dur_ms)?);
    }
    if end_ms > MAX_TOTAL_MS {
        return None;
    }
    let total = (end_ms as usize * RATE as usize) / 1000;
    let mut mix = vec![0f32; total];
    let fade = FADE_MS / 1000.0 * RATE as f32;
    for n in notes {
        let start = (n.at_ms as usize * RATE as usize) / 1000;
        let len = (n.dur_ms as usize * RATE as usize) / 1000;
        let gain = n.gain.clamp(0.0, 1.0);
        for i in 0..len {
            let Some(slot) = mix.get_mut(start + i) else {
                break;
            };
            let t = i as f32 / RATE as f32;
            // Quick attack, then an exponential-looking decay to the end of the note.
            let attack = (i as f32 / fade).min(1.0);
            let decay = 1.0 - i as f32 / len as f32;
            let wave = (std::f32::consts::TAU * n.hz * t).sin();
            *slot += wave * gain * attack * decay * decay;
        }
    }
    // Leave headroom: several notes may overlap.
    let scale = volume * 0.6 * f32::from(i16::MAX);
    let data: Vec<u8> = mix
        .iter()
        .flat_map(|s| ((s * scale).clamp(-32_767.0, 32_767.0) as i16).to_le_bytes())
        .collect();
    let mut wav = Vec::with_capacity(44 + data.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&1u16.to_le_bytes()); // mono
    wav.extend_from_slice(&RATE.to_le_bytes());
    wav.extend_from_slice(&(RATE * 2).to_le_bytes());
    wav.extend_from_slice(&2u16.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&(data.len() as u32).to_le_bytes());
    wav.extend_from_slice(&data);
    Some(wav)
}

/// Plays the tone in the background (Windows only; other systems do nothing). Returns false when
/// the request was invalid. A newer tone replaces one that is still playing.
pub fn play(notes: &[Note], volume: f32) -> bool {
    let Some(wav) = render_wav(notes, volume) else {
        return false;
    };
    imp::play(wav);
    true
}

#[cfg(windows)]
mod imp {
    use windows::core::PCWSTR;
    use windows::Win32::Media::Audio::{PlaySoundW, SND_MEMORY, SND_NODEFAULT, SND_SYNC};

    pub fn play(wav: Vec<u8>) {
        // `SND_SYNC` blocks until the tone ends, so it gets its own thread, which also keeps the
        // buffer alive for exactly as long as the system reads it.
        std::thread::spawn(move || {
            // SAFETY: `wav` is a complete WAV image that outlives the synchronous call; with
            // `SND_MEMORY` the "name" parameter is a pointer to that image.
            unsafe {
                let _ = PlaySoundW(
                    PCWSTR(wav.as_ptr().cast()),
                    None,
                    SND_MEMORY | SND_SYNC | SND_NODEFAULT,
                );
            }
        });
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn play(_wav: Vec<u8>) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(hz: f32, at_ms: u32, dur_ms: u32) -> Note {
        Note {
            hz,
            at_ms,
            dur_ms,
            gain: 1.0,
        }
    }

    #[test]
    fn renders_a_valid_wav_of_the_right_length() {
        let wav = render_wav(&[note(660.0, 0, 200), note(880.0, 200, 300)], 0.5).unwrap();
        assert_eq!(&wav[..4], b"RIFF");
        assert_eq!(&wav[8..16], b"WAVEfmt ");
        let data_len = u32::from_le_bytes(wav[40..44].try_into().unwrap()) as usize;
        assert_eq!(data_len, wav.len() - 44);
        // 500 ms of 16-bit mono at 22.05 kHz
        assert_eq!(data_len, 22_050 / 2 * 2);
    }

    #[test]
    fn volume_scales_the_signal_and_zero_is_silent() {
        let peak = |v: f32| {
            let wav = render_wav(&[note(440.0, 0, 100)], v).unwrap();
            wav[44..]
                .chunks_exact(2)
                .map(|b| i16::from_le_bytes([b[0], b[1]]).unsigned_abs())
                .max()
                .unwrap()
        };
        assert_eq!(peak(0.0), 0);
        assert!(peak(1.0) > peak(0.3) * 2);
        // a volume above 1 is clamped, never louder than full
        assert_eq!(peak(5.0), peak(1.0));
    }

    #[test]
    fn rejects_invalid_requests() {
        assert!(render_wav(&[], 0.5).is_none());
        assert!(render_wav(&[note(50.0, 0, 100)], 0.5).is_none());
        assert!(render_wav(&[note(9000.0, 0, 100)], 0.5).is_none());
        assert!(render_wav(&[note(f32::NAN, 0, 100)], 0.5).is_none());
        assert!(render_wav(&[note(440.0, 0, 0)], 0.5).is_none());
        assert!(render_wav(&[note(440.0, 2_000, 1_000)], 0.5).is_none());
        assert!(render_wav(&[note(440.0, u32::MAX, 10)], 0.5).is_none());
        assert!(render_wav(&[note(440.0, 0, 50); 9], 0.5).is_none());
        assert!(render_wav(&[note(440.0, 0, 50)], f32::NAN).is_none());
    }

    #[test]
    fn play_reports_invalid_requests() {
        assert!(!play(&[], 0.5));
        assert!(play(&[note(440.0, 0, 50)], 0.0));
    }
}
