/**
 * Conflict detection utilities for handling concurrent modifications
 * with optimistic updates and version tracking.
 */

export type OptimisticUpdateStatus = 'pending' | 'synced' | 'conflicted';

export interface OptimisticUpdate<T> {
	id: string;
	localVersion: number;
	serverVersion: number;
	localData: T;
	serverData: T;
	status: OptimisticUpdateStatus;
	timestamp: number;
}

export interface ConflictResult {
	hasConflict: boolean;
	localVersion: number;
	serverVersion: number;
	message: string;
}

export type ConflictResolutionStrategy = 'local-wins' | 'server-wins' | 'merge';

export class ConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

export function detectConflict(localVersion: number, serverVersion: number): ConflictResult {
	if (localVersion < 0 || serverVersion < 0) {
		throw new ConflictError('Version numbers cannot be negative');
	}

	if (localVersion === serverVersion) {
		return {
			hasConflict: false,
			localVersion,
			serverVersion,
			message: 'Versions match'
		};
	}

	if (serverVersion > localVersion) {
		return {
			hasConflict: true,
			localVersion,
			serverVersion,
			message: `Server version (${serverVersion}) is ahead of local version (${localVersion})`
		};
	}

	return {
		hasConflict: true,
		localVersion,
		serverVersion,
		message: `Local version (${localVersion}) is ahead of server version (${serverVersion})`
	};
}

export function createOptimisticUpdate<T>(id: string, data: T, version: number): OptimisticUpdate<T> {
	if (id === '') {
		throw new ConflictError('Update ID cannot be empty');
	}

	if (version < 0) {
		throw new ConflictError('Version number cannot be negative');
	}

	return {
		id,
		localVersion: version,
		serverVersion: version,
		localData: data,
		serverData: data,
		status: 'pending',
		timestamp: Date.now()
	};
}

export function resolveConflict<T>(
	update: OptimisticUpdate<T>,
	strategy: ConflictResolutionStrategy,
	customMerge?: (local: T, server: T) => T
): OptimisticUpdate<T> {
	const newVersion = Math.max(update.localVersion, update.serverVersion) + 1;
	let resolvedData: T;

	switch (strategy) {
		case 'local-wins':
			resolvedData = update.localData;
			break;
		case 'server-wins':
			resolvedData = update.serverData;
			break;
		case 'merge':
			if (customMerge) {
				resolvedData = customMerge(update.localData, update.serverData);
			} else {
				// Default merge: server base with local overlay (for object types)
				if (
					typeof update.localData === 'object' &&
					update.localData !== null &&
					typeof update.serverData === 'object' &&
					update.serverData !== null
				) {
					resolvedData = { ...update.localData, ...update.serverData } as T;
				} else {
					resolvedData = update.serverData;
				}
			}
			break;
		default:
			throw new ConflictError(`Invalid resolution strategy: ${strategy}`);
	}

	return {
		...update,
		localData: resolvedData,
		serverData: resolvedData,
		localVersion: newVersion,
		serverVersion: newVersion,
		status: 'synced',
		timestamp: Date.now()
	};
}
