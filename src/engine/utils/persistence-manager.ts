// Backward-compatibility re-exports.
// The persistence module has been moved to src/engine/persistence/.
// All 26+ consumer files continue working with zero import changes.
export { PersistenceManager } from '../persistence/persistence-manager';
export { StorageKey } from '../persistence/storage-key';
