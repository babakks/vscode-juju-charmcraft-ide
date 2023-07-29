import { Disposable } from "vscode";

export class ExtensionTree implements Disposable {
    private readonly _disposables: Disposable[] = [];

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }
}