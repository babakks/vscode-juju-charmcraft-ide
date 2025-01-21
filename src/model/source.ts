import {
    CHARM_DIR_SRC,
    CHARM_DIR_SRC_MAIN,
    CHARM_SOURCE_CODE_CHARM_BASE_CLASS,
    Range,
    TextPositionMapper,
    comparePositions,
    escapeRegex,
    type Problem
} from "./common";

export const SOURCE_CODE_PROBLEMS = {
    /**
     * Problems specific to referencing charm belongings (e.g., configuration parameters or actions).
     */
    reference: {
        undefinedConfigParameter: (name: string) => ({ id: 'undefinedConfigParameter', name, message: `Undefined configuration parameter \`${name}\`` }),
        undefinedEvent: (symbol: string) => ({ id: 'undefinedEvent', name: symbol, message: `Undefined event \`${symbol}\`` }),
    },
} satisfies Record<string, Record<string, Problem | ((...args: any[]) => Problem)>>;

export class SourceCodeFile {
    private _analyzer: SourceCodeFileAnalyzer | undefined;
    private _tpm: TextPositionMapper | undefined;

    constructor(public content: string, public ast: any, public healthy: boolean) { }

    /**
     * Returns the generic source code analyzer instance.
     */
    get analyzer() {
        if (!this._analyzer) {
            this._analyzer = new SourceCodeFileAnalyzer(this.content, this.ast);
        }
        return this._analyzer;
    }

    get tpm() {
        if (!this._tpm) {
            this._tpm = new TextPositionMapper(this.content);
        }
        return this._tpm;
    }
}

export type SourceCodeTreeEntry = SourceCodeTreeDirectoryEntry | SourceCodeTreeFileEntry;

export interface SourceCodeTree {
    [key: string]: SourceCodeTreeEntry;
}

export interface SourceCodeTreeDirectoryEntry {
    kind: 'directory';
    data: SourceCodeTree;
}

export interface SourceCodeTreeFileEntry {
    kind: 'file';
    data: SourceCodeFile;
}

export interface SourceCodeCharmClass extends SourceCodeClass {
    subscribedEvents: SourceCodeCharmClassSubscribedEvent[];
}

export interface SourceCodeCharmClassSubscribedEvent {
    event: string;
    handler: string;
};

export type SourceCodeCharmTestClassDialect = 'unittest.TestCase' | 'pytest';

export interface SourceCodeCharmTestClass extends SourceCodeClass {
    dialect: SourceCodeCharmTestClassDialect;
    testMethods: SourceCodeFunction[];
}

export interface SourceCodeClass {
    /**
     * Raw AST data.
     */
    raw: any;
    range: Range;
    /**
     * Extended (greedy) range of the node that covers trailing whitespace or empty lines.
     */
    extendedRange: Range;
    name: string;
    bases: string[];
    /**
     * Class methods, ordered by their lexical position.
     */
    methods: SourceCodeFunction[];
};

export type SourceCodeFunctionKind =
    /**
     * Functions defined at file-scope.
     */
    'function' |
    /**
     * Function definitions enclosed by a class.
     */
    'method' |
    /**
     * Class property getters.
     */
    'getter' |
    /**
     * Class property setters.
     */
    'setter';

export interface SourceCodeFunction {
    /**
     * Raw AST data.
     */
    raw: any;
    range: Range;
    /**
     * Extended (greedy) range of the node that covers trailing whitespace or empty lines.
     */
    extendedRange: Range;
    kind: SourceCodeFunctionKind;
    isStatic: boolean;
    isAsync: boolean;
    name: string;
    positionalParameters: string[];
};

/**
 * Note that independent of the platform, relative paths referenced are separated
 * with `/` (forward slash).
 */
export class SourceCode {
    constructor(readonly tree: SourceCodeTree) { }

    private _getEntryAt(relativePath: string): SourceCodeTreeFileEntry | SourceCodeTreeDirectoryEntry | undefined {
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

    /**
     * Returns a flat map of files and their relative path in the source code
     * tree. Note that the results are not ordered in a specific manner.
     *
     * Note that independent of the platform, relative paths are separated with
     * `/` (forward slash).
     */
    getFiles(): Map<string, SourceCodeFile> {
        const result = new Map<string, SourceCodeFile>();

        const stack: [string, SourceCodeTreeEntry][] = [];
        function push(tree: SourceCodeTree, relativePath?: string) {
            stack.push(...Object.entries(tree).map(([k, v]) =>
                [relativePath !== undefined ? relativePath + '/' + k : k, v] as [string, SourceCodeTreeEntry]
            ));
        }

        push(this.tree);
        while (true) {
            const element = stack.pop();
            if (!element) {
                break;
            }
            const [relativePath, entry] = element;
            if (entry.kind === 'directory') {
                push(entry.data, relativePath);
                continue;
            }
            result.set(relativePath, entry.data);
        }
        return result;
    }

    /**
     * Note that independent of the platform, relative paths are separated with
     * `/` (forward slash).
     */
    getFile(relativePath: string): SourceCodeFile | undefined {
        const entry = this._getEntryAt(relativePath);
        return entry?.kind === 'file' ? entry.data : undefined;
    }

    /**
     * Note that independent of the platform, relative paths are separated with
     * `/` (forward slash).
     */
    updateFile(relativePath: string, file: SourceCodeFile) {
        const entry = this._getEntryAt(relativePath);
        if (entry?.kind === 'file') {
            entry.data = file;
        }
    }

    /**
     * Note that independent of the platform, relative paths are separated with
     * `/` (forward slash).
     */
    isMain(relativePath: string): boolean {
        // TODO: This may not be the exact criteria for the main charm file.
        return relativePath === `${CHARM_DIR_SRC}/${CHARM_DIR_SRC_MAIN}`;
    }
}

const NODE_TYPE_NAME = 'Name';
const NODE_TYPE_CLASS_DEF = 'ClassDef';
const NODE_TYPE_FUNCTION_DEF = 'FunctionDef';
const NODE_TYPE_ASYNC_FUNCTION_DEF = 'AsyncFunctionDef';
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

const TEST_UNITTEST_BASE_CLASS = 'TestCase';
const TEST_PYTEST_CLASS_PREFIX = 'Test';
const TEST_FUNCTION_PREFIX = 'test_';

export class SourceCodeFileAnalyzer {
    readonly tpm: TextPositionMapper;

    private _classes: SourceCodeClass[] | undefined | null = null;
    private _functions: SourceCodeFunction[] | undefined | null = null;
    private _charmClasses: SourceCodeClass[] | undefined | null = null;
    private _mainCharmClass: SourceCodeClass | undefined | null = null;
    private _testClasses: SourceCodeCharmTestClass[] | undefined | null = null;
    private _testFunctions: SourceCodeFunction[] | undefined | null = null;

    constructor(readonly content: string, readonly ast: any | undefined) {
        this.tpm = new TextPositionMapper(this.content);
    }

    /**
     * Resets analyses' results.
     */
    reset() {
        this._classes = null;
        this._functions = null;
        this._charmClasses = null;
        this._mainCharmClass = null;
        this._testClasses = null;
        this._testFunctions = null;
    }

    /**
     * Returns the list of classes defined in the file-scope. This also includes
     * test and charm-based classes.
     */
    get classes(): SourceCodeClass[] | undefined {
        if (this._classes !== null) {
            return this._classes;
        }
        return this._classes = this._getClasses(this.ast, this.tpm.all());
    }

    /**
     * Returns the list of functions defined in the file-scope. This also includes
     * test functions.
     */
    get functions(): SourceCodeFunction[] | undefined {
        if (this._functions !== null) {
            return this._functions;
        }
        return this._functions = this._getFunctions(this.ast, this.tpm.all());
    }

    /**
     * Returns the list of charm-based classes, ordered by their lexical
     * position, in the file-scope.
     */
    get charmClasses(): SourceCodeClass[] | undefined {
        if (this._charmClasses !== null) {
            return this._charmClasses;
        }
        return this._charmClasses = this._getCharmClasses();
    }

    get mainCharmClass(): SourceCodeClass | undefined {
        if (this._mainCharmClass !== null) {
            return this._mainCharmClass;
        }
        return this._mainCharmClass = this._getMainCharmClass();
    }

    /**
     * Returns the list of test classes defined in the file-scope.
     */
    get testClasses(): SourceCodeCharmTestClass[] | undefined {
        if (this._testClasses !== null) {
            return this._testClasses;
        }
        return this._testClasses = this._getTestClasses();
    }

    /**
     * Returns the list of test functions defined in the file-scope.
     */
    get testFunctions(): SourceCodeFunction[] | undefined {
        if (this._testFunctions !== null) {
            return this._testFunctions;
        }
        return this._testFunctions = this._getTestFunctions();
    }

    private _getClasses(parent: any, parentExtendedRange: Range): SourceCodeClass[] | undefined {
        if (!parent) {
            return undefined;
        }

        const body = parent['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const result: SourceCodeClass[] = [];
        for (let i = 0; i < body.length; i++) {
            const cls = body[i];
            if (cls['$type'] !== NODE_TYPE_CLASS_DEF) {
                continue;
            }

            const bases = cls['bases'];
            if (!bases || !Array.isArray(bases)) {
                continue;
            }

            const range = getNodeRange(cls);
            const isLast = i === -1 + body.length;
            const extendedRange = !isLast ? getNodeExtendedRange(cls, body[1 + i]) : { start: range.start, end: parentExtendedRange.end };

            result.push({
                raw: cls,
                name: unquoteSymbol(cls['name'] as string),
                bases: this._getBaseClasses(bases),
                methods: this._getFunctions(cls, extendedRange, true) ?? [],
                range,
                extendedRange,
            });
        }
        return result;
    }

    private _getBaseClasses(bases: any[]): string[] {
        const result: string[] = [];
        for (const b of bases) {
            if (b['$type'] === NODE_TYPE_NAME && b['id']) {
                // Cases: `class MyClass(MyBaseClass)`
                const id = unquoteSymbol(b['id']);
                result.push(id);
            } else if (b['$type'] === NODE_TYPE_ATTRIBUTE && b['attr']) {
                // Cases: `class MyClass(ops.MyBaseClass)`
                const id = unquoteSymbol(b['attr']);
                result.push(id);
            }
        }
        return result;
    }

    private _getFunctions(parent: any, parentExtendedRange: Range, isParentAClass?: boolean): SourceCodeFunction[] | undefined {
        if (!parent) {
            return undefined;
        }

        const body = parent['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const result: SourceCodeFunction[] = [];
        for (let i = 0; i < body.length; i++) {
            const method = body[i];
            if (method['$type'] !== NODE_TYPE_FUNCTION_DEF
                && method['$type'] !== NODE_TYPE_ASYNC_FUNCTION_DEF) {
                continue;
            }

            const positionalParameters = (method['args']?.['args'] as Array<any> ?? []).filter(x => x['$type'] === NODE_TYPE_ARG && x['arg']).map(x => unquoteSymbol(x['arg']));
            const range = getNodeRange(method);
            const isLast = i === -1 + body.length;
            const extendedRange = !isLast ? getNodeExtendedRange(method, body[1 + i]) : { start: range.start, end: parentExtendedRange.end };
            result.push({
                raw: method,
                name: unquoteSymbol(method['name'] as string),
                kind: isParentAClass ? this._getClassMethodKind(method) : 'function',
                isStatic: isParentAClass ? this._isClassMethodStatic(method) : false,
                isAsync: method['$type'] === NODE_TYPE_ASYNC_FUNCTION_DEF,
                range,
                extendedRange,
                positionalParameters,
            });
        }
        result.sort((a, b) => comparePositions(a.range.start, b.range.start));
        return result;
    }

    private _getClassMethodKind(node: any): SourceCodeFunctionKind {
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

    private _getCharmClasses(): SourceCodeCharmClass[] | undefined {
        return this.classes?.filter(x => x.bases.indexOf(CHARM_SOURCE_CODE_CHARM_BASE_CLASS) !== -1)
            .map(x => ({
                ...x,
                // TODO `getClassSubscribedEvents` is not implemented yet.
                subscribedEvents: this._getClassSubscribedEvents(x.raw),
            }));
    }

    private _getMainCharmClass(): SourceCodeClass | undefined {
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

            const nodeText = this.tpm.getTextOverRange(getNodeRange(x));
            const charmClass = classes.find(x => nodeText.match(new RegExp(`(^\\s*|\\W)${escapeRegex(x.name)}(\\W|\\s*$)`)));
            if (charmClass) {
                return charmClass;
            }
        }
        return undefined;
    }

    private _getClassSubscribedEvents(cls: any): SourceCodeCharmClassSubscribedEvent[] {
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
        return [];
    }

    private _getTestClasses(): SourceCodeCharmTestClass[] | undefined {
        /**
         * See the Pytest test discovery convention at:
         *   https://docs.pytest.org/en/7.4.x/explanation/goodpractices.html#conventions-for-python-test-discovery
         */
        const isPytestTestClass = (cls: SourceCodeClass) =>
            cls.name.startsWith(TEST_PYTEST_CLASS_PREFIX)
            && !cls.methods.find(x => x.name === NODE_NAME_FUNCTION_INIT); // No init/constructor method.
        const isUnittestTestClass = (cls: SourceCodeClass) =>
            cls.bases.some(x => x === TEST_UNITTEST_BASE_CLASS);

        return this.classes?.filter(x => isUnittestTestClass(x) || isPytestTestClass(x))
            .map(x => ({
                dialect: isUnittestTestClass(x) ? 'unittest.TestCase' : 'pytest',
                testMethods: x.methods.filter(y => this._isTestFunction(y)),
                ...x,
            }));
    }

    private _isTestFunction(fn: SourceCodeFunction): boolean {
        return fn.name.startsWith(TEST_FUNCTION_PREFIX);
    }

    private _getTestFunctions(): SourceCodeFunction[] | undefined {
        return this.functions?.filter(y => this._isTestFunction(y));
    }
}

export function getNodeRange(node: any): Range {
    return {
        start: { line: -1 + Number.parseInt(node.lineno), character: Number.parseInt(node.col_offset) },
        end: { line: -1 + Number.parseInt(node.end_lineno), character: Number.parseInt(node.end_col_offset) },
    };
}

export function getNodeExtendedRange(node: any, nextNode: any): Range {
    const range = getNodeRange(node);
    if (!nextNode) {
        return getNodeRange(node);
    }
    const nextNodeRange = getNodeRange(nextNode);
    const firstDecorator = nextNode['decorator_list']?.[0];
    const nextNodeStart = firstDecorator ? getNodeRange(firstDecorator).start : nextNodeRange.start;
    return nextNodeStart.line === range.end.line
        ? { start: range.start, end: nextNodeStart }
        : { start: range.start, end: { line: nextNodeStart.line, character: 0 } };
}

export function unquoteSymbol(s: string): string {
    if (s.length < 2) {
        return s;
    }
    const quote = s.charAt(0);
    if (quote !== '"' && quote !== "'") {
        return s;
    }
    if (s.charAt(-1 + s.length) !== quote) {
        return s;
    }
    return s.substring(1, -1 + s.length);
}
