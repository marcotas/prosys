// ChangeNotifier — vanilla TypeScript observable base class.
// Controllers extend this. Framework-agnostic, zero Svelte imports.

export class ChangeNotifier {
	private listeners = new Set<() => void>();

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	protected notifyChanges(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	dispose(): void {
		this.listeners.clear();
	}
}
