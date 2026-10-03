/**
 * Lets an emitter wait until the module services are running. Deliberately tiny and free of
 * imports: module pages use it, and `services.ts` (which pulls in every manifest) must not end up
 * in their import graph.
 */
type Waiter = (opts?: { fresh?: boolean }) => Promise<void>;
let waiter: Waiter | null = null;

/** Set by `startModuleServices` while the services are hosted; `null` clears it. */
export function setServicesWaiter(next: Waiter | null): void {
  waiter = next;
}

/**
 * Resolves once the services of all enabled modules are running. The UI renders before they are
 * loaded (each service is a dynamic import, started one after the other), and the event bus has
 * no memory: an event emitted earlier reaches nobody. Emitters that hand work to another module
 * (e.g. the pantry asking the shopping list) wait for this first. Resolves at once when the
 * services are not hosted (unit tests, before `startModuleServices`).
 *
 * `fresh: true` first re-reads which modules are enabled: the service host follows module
 * toggles through a database subscription that fires a moment after the write, so right after
 * switching a module on the plain wait would not yet know about its service.
 */
export function whenServicesSettled(opts?: { fresh?: boolean }): Promise<void> {
  return waiter ? waiter(opts) : Promise.resolve();
}
