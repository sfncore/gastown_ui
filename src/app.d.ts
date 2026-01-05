// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Background Sync API types
	interface SyncManager {
		register(tag: string): Promise<void>;
	}

	interface ServiceWorkerRegistration {
		readonly sync: SyncManager;
	}

	interface SyncEvent extends ExtendableEvent {
		readonly lastChance: boolean;
		readonly tag: string;
	}

	interface ServiceWorkerGlobalScopeEventMap {
		sync: SyncEvent;
	}
}

export {};
