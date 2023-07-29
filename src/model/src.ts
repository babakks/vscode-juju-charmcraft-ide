import { CHARM_DIR_SRC_MAIN, CHARM_SOURCE_CODE_CHARM_BASE_CLASS } from "./constant";
import {
    CharmSourceCodeFile,
    CharmSourceCodeTree,
    CharmSourceCodeTreeDirectoryEntry,
    CharmSourceCodeTreeFileEntry,
    Range
} from "./type";
import {
    comparePositions,
    escapeRegex,
    getNodeExtendedRange,
    getNodeRange,
    getTextOverRange,
    unquoteSymbol
} from "./util";

export class CharmSourceCode {
    constructor(readonly tree: CharmSourceCodeTree) { }

    private _getEntryAt(relativePath: string): CharmSourceCodeTreeFileEntry | CharmSourceCodeTreeDirectoryEntry | undefined {
        const components = relativePath.split('/');
        let dir = this.tree;
        for (let i = 0; i < components.length; i++) {
            const current = dir[components[i]];
            if (!current) {
                return undefined;
            }
            const isLast = i === -1 + components.length;
            if (isLast) {
                return current;
            }
            if (current.kind !== 'directory') {
                return undefined;
            }
            dir = current.data;
        }
        return undefined;
    }

    getFile(relativePath: string): CharmSourceCodeFile | undefined {
        const entry = this._getEntryAt(relativePath);
        return entry?.kind === 'file' ? entry.data : undefined;
    }

    updateFile(relativePath: string, file: CharmSourceCodeFile) {
        const entry = this._getEntryAt(relativePath);
        if (entry?.kind === 'file') {
            entry.data = file;
        }
    }

    /**
     * Determines if given relative path points to charm main source code file
     * (i.e., the file that has the charm class definition).
     */
    isMain(relativePath: string): boolean {
        // TODO: This may not be the exact criteria for the main charm file. 
        return relativePath === CHARM_DIR_SRC_MAIN;
    }
}

export type CharmClass = {
    range: Range;
    /**
     * Extended (greedy) range of the node that covers trailing whitespace or empty lines. 
     */
    extendedRange: Range;
    name: string;
    base: string;
    /**
     * Charm methods, ordered by their lexical position.
     */
    methods: CharmClassMethod[];
    subscribedEvents: CharmClassSubscribedEvent[];
};

export type CharmClassMethodKind = 'method' | 'getter' | 'setter';
export type CharmClassMethod = {
    range: Range;
    /**
     * Extended (greedy) range of the node that covers trailing whitespace or empty lines. 
     */
    extendedRange: Range;
    kind: CharmClassMethodKind;
    isStatic: boolean;
    name: string;
    positionalParameters: string[];
};

export type CharmClassSubscribedEvent = {
    event: string;
    handler: string;
};

const NODE_TYPE_NAME = 'Name';
const NODE_TYPE_CLASS_DEF = 'ClassDef';
const NODE_TYPE_FUNCTION_DEF = 'FunctionDef';
const NODE_TYPE_ARGUMENTS = 'arguments';
const NODE_TYPE_ARG = 'arg';
const NODE_TYPE_ATTRIBUTE = 'Attribute';
const NODE_TYPE_IF = 'If';
const NODE_TYPE_COMPARE = 'If';
const NODE_TYPE_EQ = 'Eq';
const NODE_TYPE_CONSTANT = 'Constant';
const NODE_NAME_FUNCTION_INIT = '__init__';

const CONSTANT_VALUE_PROPERTY = 'property';
const CONSTANT_VALUE_NAME = '__name__';
const CONSTANT_VALUE_MAIN = '__main__';
const CONSTANT_VALUE_SETTER = 'setter';
const CONSTANT_VALUE_STATIC_METHOD = 'staticmethod';

export class CharmSourceCodeFileAnalyzer {
    private _charmClasses: CharmClass[] | undefined | null = null;
    private _mainCharmClass: CharmClass | undefined | null = null;
    private readonly _lines: string[];

    constructor(readonly content: string, readonly ast: any | undefined) {
        this._lines = content.split('\n').map(x => x.endsWith('\r') ? x.substring(0, -1 + x.length) : x);
    }

    /**
     * Resets analyses' results.
     */
    reset() {
        this._charmClasses = null;
        this._mainCharmClass = null;
    }

    /**
     * Charm-based classes, ordered by their lexical position.
     */
    get charmClasses(): CharmClass[] | undefined {
        if (this._charmClasses !== null) {
            return this._charmClasses;
        }
        return this._charmClasses = this._getCharmClasses();
    }

    get mainCharmClass(): CharmClass | undefined {
        if (this._mainCharmClass !== null) {
            return this._mainCharmClass;
        }
        return this._mainCharmClass = this._getMainCharmClass();
    }

    private _getCharmClasses(): CharmClass[] | undefined {
        const body = this.ast?.['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const result: CharmClass[] = [];
        for (let i = 0; i < body.length; i++) {
            const cls = body[i];
            if (cls['$type'] !== NODE_TYPE_CLASS_DEF) {
                continue;
            }

            const bases = cls['bases'];
            if (!bases || !Array.isArray(bases)) {
                continue;
            }

            const baseClass = this._findAppropriateCharmBaseClass(bases);
            if (!baseClass) {
                continue;
            }

            const range = getNodeRange(cls);
            const extendedRange = getNodeExtendedRange(cls, body[1 + i]);

            result.push({
                name: unquoteSymbol(cls['name'] as string),
                base: baseClass,
                methods: this._getClassMethods(cls, extendedRange) ?? [],
                subscribedEvents: this._getClassSubscribedEvents(cls) ?? [],
                range,
                extendedRange,
            });
        }
        return result;
    }

    private _findAppropriateCharmBaseClass(bases: any[]): string | undefined {
        for (const b of bases) {
            if (b['$type'] === NODE_TYPE_NAME && b['id']) {
                // Cases: `class MyCharm(CharmBase)`
                const id = unquoteSymbol(b['id']);
                if (id === CHARM_SOURCE_CODE_CHARM_BASE_CLASS) {
                    return id;
                }
            } else if (b['$type'] === NODE_TYPE_ATTRIBUTE && b['attr']) {
                // Cases: `class MyCharm(ops.CharmBase)`
                const id = unquoteSymbol(b['attr']);
                if (id === CHARM_SOURCE_CODE_CHARM_BASE_CLASS) {
                    return id;
                }
            }
        }
        return undefined;
    }

    private _getMainCharmClass(): CharmClass | undefined {
        const classes = this.charmClasses;
        if (!classes) {
            return undefined;
        }

        const body = this.ast?.['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const ifs = body.filter(x => x['$type'] === NODE_TYPE_IF).reverse();
        for (const x of ifs) {
            /*
             * Looking for:
             *
             *     if __name__=="__main__":
             */
            const isEntrypointIf =
                x['$type'] === NODE_TYPE_COMPARE
                && x['test']?.['left']?.['$type'] === NODE_TYPE_NAME
                && x['test']['left']['id'] && unquoteSymbol(x['test']['left']['id']) === CONSTANT_VALUE_NAME
                && x['test']['ops'] && x['test']['ops'].length && x['test']['ops'][0]?.['$type'] === NODE_TYPE_EQ
                && x['test']['comparators']?.[0]?.['$type'] === NODE_TYPE_CONSTANT
                && x['test']['comparators'][0]['value']
                && unquoteSymbol(x['test']['comparators'][0]['value']) === CONSTANT_VALUE_MAIN;
            if (!isEntrypointIf) {
                continue;
            }

            const nodeText = getTextOverRange(this._lines, getNodeRange(x));
            const charmClass = classes.find(x => nodeText.match(new RegExp(`(^\\s*|\\W)${escapeRegex(x.name)}(\\W|\\s*$)`)));
            if (charmClass) {
                return charmClass;
            }
        }
        return undefined;
    }

    private _getClassMethods(cls: any, clsExtendedRange: Range): CharmClassMethod[] | undefined {
        const body = cls['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const result: CharmClassMethod[] = [];
        for (let i = 0; i < body.length; i++) {
            const method = body[i];
            if (method['$type'] !== NODE_TYPE_FUNCTION_DEF) {
                continue;
            }

            const positionalParameters = (method['args']?.['args'] as Array<any> ?? []).filter(x => x['$type'] === NODE_TYPE_ARG && x['arg']).map(x => unquoteSymbol(x['arg']));
            const range = getNodeRange(method);
            const isLast = i === -1 + body.length;
            const extendedRange = !isLast ? getNodeExtendedRange(method, body[1 + i]) : { start: range.start, end: clsExtendedRange.end };
            result.push({
                name: unquoteSymbol(method['name'] as string),
                kind: this._getMethodKind(method),
                isStatic: this._isClassMethodStatic(method),
                range,
                extendedRange,
                positionalParameters,
            });
        }
        result.sort((a, b) => comparePositions(a.range.start, b.range.start));
        return result;
    }

    private _getMethodKind(node: any): CharmClassMethodKind {
        const decorators = node['decorator_list'] as Array<any> ?? [];
        for (const d of decorators) {
            if (d['$type'] === NODE_TYPE_NAME && d['id']) {
                const id = unquoteSymbol(d['id']);
                if (id === CONSTANT_VALUE_PROPERTY) {
                    /*
                     * Property getters:
                     *
                     *    @property
                     *    def my_property(self):
                     */
                    return 'getter';
                }
            } else if (d['$type'] === NODE_TYPE_ATTRIBUTE && d['attr']) {
                const attr = unquoteSymbol(d['attr']);
                if (attr === CONSTANT_VALUE_SETTER) {
                    /*
                     * Property setters:
                     *
                     *    @my_property.setter
                     *    def my_property(self, value):
                     */
                    return 'setter';
                }
            }
        }
        return 'method';
    }

    private _isClassMethodStatic(node: any): boolean {
        if (node['args']?.['$type'] === NODE_TYPE_ARGUMENTS
            && Array.isArray(node['args']['args'])
            && node['args']['args'].length === 0) {
            /*
             * Class method with no parameters:
             *
             *    def my_method():
             */
            return true;
        }

        const decorators = node['decorator_list'] as Array<any> ?? [];
        for (const d of decorators) {
            if (d['$type'] === NODE_TYPE_NAME && d['id']) {
                const id = unquoteSymbol(d['id']);
                if (id === CONSTANT_VALUE_STATIC_METHOD) {
                    /*
                     * Static method:
                     *
                     *    @staticmethod
                     *    def my_method(param):
                     */
                    return true;
                }
            }
        }
        return false;
    }

    private _getClassSubscribedEvents(cls: any): CharmClassSubscribedEvent[] | undefined {
        // const body = cls.body;
        // if (!body || !Array.isArray(body)) {
        //     return undefined;
        // }

        // const result: CharmClassMethod[] = [];
        // const methods = body.filter(x => x.$type === NODE_TYPE_FUNCTION_DEF && unquoteSymbol(x.name) === NODE_NAME_FUNCTION_INIT);
        // for (const method of methods) {
        //     result.push({
        //         name: unquoteSymbol(method.name as string),
        //         range: getNodeRange(method),
        //     });
        // }
        // return result;
        return undefined;
    }
}