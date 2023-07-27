import { Uri } from "vscode";
import { Charm } from "./charm";
import { CharmSourceCodeFile } from "./charm.type";
import { ExtensionCharm } from "./extension.charm";

export interface CharmDataProvider {
    getCharmBySourceCodeFile(uri: Uri): { charm: ExtensionCharm, relativePath: string } | undefined;
}