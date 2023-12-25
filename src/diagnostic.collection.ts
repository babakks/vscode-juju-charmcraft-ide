import { Uri, DiagnosticCollection, Diagnostic, Disposable } from 'vscode';

export class DiagnosticCollectionManager implements Disposable {
    private _disposed = false;
    private _uris = new Set<string>();

    constructor(readonly charmHome: Uri, readonly collection: DiagnosticCollection) { }

    dispose() {
        this.reset();
        this._disposed = true;
    }

    /**
     * Updates entire diagnostic entries.
     * @param map Map of relative paths (to charm home directory) to diagnostic entry arrays.
     */
    update(map: Map<string, Diagnostic[]>) {
        if (this._disposed) {
            return;
        }
        this.reset();
        for (const [relativePath, diags] of map) {
            const uri = Uri.joinPath(this.charmHome, relativePath);
            this.updateByURI(uri, diags);
        }
    }

    updateByURI(uri: Uri, entries: Diagnostic[]) {
        if (this._disposed) {
            return;
        }
        this.collection.delete(uri);
        this._uris.add(uri.toString());
        this.collection.set(uri, entries);
    }

    reset() {
        if (this._disposed) {
            return;
        }
        const clone = Array.from(this._uris);
        clone.forEach(x => {
            const uri = Uri.parse(x);
            if (this.collection.has(uri)) {
                this.collection.delete(uri);
            }
            this._uris.delete(x);
        });
    }
}
