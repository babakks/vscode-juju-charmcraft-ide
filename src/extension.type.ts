import { Uri } from "vscode";
import { Charm } from "./charm";

export type CharmProvider = (uri: Uri) => Charm | undefined;
