/**
 * Lets an emitter wait until the module services are running. Deliberately tiny and free of
 * imports: module pages use it, and `services.ts` (which pulls in every manifest) must not end up
 * in their import graph.
 */
type Waiter = () => Promise<void>;
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
 */
export function whenServicesSettled(): Promise<void> {
  return waiter ? waiter() : Promise.resolve();
}
