import {
    CHARM_DIR_SRC_MAIN,
    CHARM_SOURCE_CODE_CHARM_BASE_CLASS,
    Position,
    Range,
    TextPositionMapper,
    comparePositions,
    toValidSymbol
} from "./common";

export interface Problem {
    message: string;
    /**
     * Should be used for further identification of a problem type (e.g., to provide fix suggestions).
     */
    id?: string;
    key?: string;
    index?: number;
    /**
     * Supplementary data for further usage (e.g., when providing fix suggestions).
     */
    [key: string]: any;
}

export const YAML_PROBLEMS = {
    /**
     * Generic YAML file problems.
     */
    generic: {
        invalidYAML: { id: 'invalidYAML', message: "Invalid YAML file." },
        missingField: (key: string) => ({ id: 'missingField', key, message: `Missing \`${key}\` field.` }),
        unexpectedScalarType: (expected: 'string' | 'integer' | 'number' | 'boolean') => ({ id: 'unexpectedScalarType', expected, message: `Must be ${expected === 'integer' ? 'an' : 'a'} ${expected}.` }),
        expectedSequenceOfScalars: (expected: 'string' | 'integer' | 'number' | 'boolean') => ({ id: 'expectedSequenceOfScalars', expected, message: `Must be a sequence of ${expected} values.` }),
        expectedScalarOrSequence: (expected: 'string' | 'integer' | 'number' | 'boolean') => ({ id: 'expectedScalarOrSequence', expected, message: `Must be ${expected === 'integer' ? 'an' : 'a'} ${expected} or a sequence of them.` }),
        expectedMap: { id: 'expectedMap', message: `Must be a map.` },
        expectedSequence: { id: 'expectedSequence', message: `Must be a sequence.` },
        expectedEnumValue: (expected: string[]) => ({ id: 'expectedEnumValue', expected, message: `Must be one of the following: ${expected.join(', ')}.` }),
        expectedNull: { id: 'expectedNull', message: 'Must be null' },
    },
    /**
     * Problems specific to `config.yaml`.
     */
    config: {
        /**
        * Occurs when the `default` field is assigned with a wrong type of value (e.g., object or array) and also the `type`
        * field (to pinpoint the type of the default value) is missing,
         */
        invalidDefault: { id: 'invalidDefault', message: `Default value must have a valid type; boolean, string, integer, or float.` },
        wrongDefaultType: (expected: CharmConfigParameterType) => ({ id: 'wrongDefaultType', message: `Default value must match the parameter type; it must be ${expected === 'int' ? 'an integer' : 'a ' + expected}.` }),
    },
    /**
     * Problems specific to `metadata.yaml`.
     */
    metadata: {
        assumptionExpectedAnyOfOrAllOf: { id: 'assumptionExpectedAnyOfOrAllOf', message: `Must include only one of \`any-of\` or \`all-of\` keys.` },
        assumptionExpected: { id: 'assumptionExpected', message: 'Expected a string entry or a map with only \`any-of\` or \`all-of\` keys.' },
        resourceExpectedFilenameForFileResource: { id: 'resourceExpectedFilenameForFileResource', message: `Field \`filename\` is required since resource type is \`file\`.` },
        resourceUnexpectedFilenameForNonFileResource: { id: 'resourceUnexpectedFilenameForNonFileResource', message: `Field \`filename\` must be assigned only if resource type is \`file\`.` },
        storageMultipleInvalid: { id: 'storageMultipleInvalid', message: `Should be one of \`n\`, \`n+\`, \`n-\`, or \`n-m\`, where \`n\` and \`m\` are integers.` },
        storageMinimumSizeInvalid: { id: 'storageMinimumSizeInvalid', message: `Should be either of \`n\` or \`nM\`, where \`n\` is an integer and M is a one of M, G, T, P, E, Z or Y.` },
        containerExpectedResourceOrBases: { id: 'containerExpectedResourceOrBases', message: `One of \`resource\` or \`bases\` fields must be assigned.` },
        containerExpectedOnlyResourceOrBases: { id: 'containerExpectedOnlyResourceOrBases', message: `Only one of \`resource\` or \`bases\` fields must be assigned.` },
        containerResourceUndefined: (expectedResource: string) => ({ id: 'containerResourceUndefined', expectedResource, message: `Container resource \`${expectedResource}\` is not defined.` }),
        containerResourceOCIImageExpected: (expectedResource: string) => ({ id: 'containerResourceOCIImageExpected', expectedResource, message: `Container resource \`${expectedResource}\` is not of type \`oci-image\`.` }),
        containerMountStorageUndefined: (expectedStorage: string) => ({ id: 'containerMountStorageUndefined', expectedStorage, message: `Container mount storage \`${expectedStorage}\` is not defined.` }),
    },
} satisfies Record<string, Record<string, Problem | ((...args: any[]) => Problem)>>;

export const SOURCE_CODE_PROBLEMS = {
    /**
     * Problems specific to referencing charm belongings (e.g., configuration parameters or actions).
     */
    reference: {
        undefinedConfigParameter: (name: string) => ({ id: 'undefinedConfigParameter', name, message: `Undefined configuration parameter \`${name}\`` }),
        undefinedEvent: (symbol: string) => ({ id: 'undefinedEvent', name: symbol, message: `Undefined event \`${symbol}\`` }),
    },
} satisfies Record<string, Record<string, Problem | ((...args: any[]) => Problem)>>;

export type CharmConfigParameterType = 'string' | 'int' | 'float' | 'boolean';
export function isConfigParameterType(value: string): value is CharmConfigParameterType {
    return value === 'string' || value === 'int' || value === 'float' || value === 'boolean';
}

export interface YAMLNode {
    kind?: 'map' | 'sequence' | 'pair' | 'scalar';
    range?: Range;
    pairKeyRange?: Range;
    pairValueRange?: Range;
    problems: Problem[];
    /**
     * Raw node returned by the underlying YAML parser/tokenizer library.
     */
    raw?: any;
    /**
     * Raw text content, corresponding to the {@link range `range`} property.
     */
    text: string;
    pairText?: string;
}

type AttachedNode = {
    /**
     * If the field/value was not found, this will be missing/`undefined`.
     */
    node: YAMLNode;
};

export type WithNode<T> = AttachedNode & {
    value?: T;
};

export type SequenceWithNode<T> = AttachedNode & {
    elements?: WithNode<T>[];
};

export type MapWithNode<T> = AttachedNode & {
    entries?: { [key: string]: WithNode<T> };
};

export interface CharmConfigParameter {
    name: string;
    type?: WithNode<CharmConfigParameterType>;
    description?: WithNode<string>;
    default?: WithNode<string | number | boolean>;
}

export interface CharmConfig {
    parameters?: MapWithNode<CharmConfigParameter>;
    /**
     * Root node.
     */
    node: YAMLNode;
}

export type CharmEndpointScope = 'global' | 'container';

export interface CharmEndpoint {
    name: string;
    interface?: WithNode<string>;
    limit?: WithNode<number>;
    optional?: WithNode<boolean>;
    scope?: WithNode<CharmEndpointScope>;
}

export type CharmResourceType = 'file' | 'oci-image';

export interface CharmResource {
    name: string;
    type?: WithNode<CharmResourceType>;
    description?: WithNode<string>;
    filename?: WithNode<string>;
}

export type CharmDeviceType = 'gpu' | 'nvidia.com/gpu' | 'amd.com/gpu';

export interface CharmDevice {
    name: string;
    type?: WithNode<CharmDeviceType>;
    description?: WithNode<string>;
    countMin?: WithNode<number>;
    countMax?: WithNode<number>;
}

export type CharmStorageType = 'filesystem' | 'block';

export type CharmStorageProperty = 'transient';

export interface CharmStorage {
    name: string;
    type?: WithNode<CharmStorageType>;
    description?: WithNode<string>;
    location?: WithNode<string>;
    shared?: WithNode<boolean>;
    readOnly?: WithNode<boolean>;
    multiple?: WithNode<string>;
    minimumSize?: WithNode<string>;
    properties?: SequenceWithNode<CharmStorageProperty>;
}

export interface CharmExtraBinding {
    name: string;
}

export interface CharmContainerBase {
    name?: WithNode<string>;
    channel?: WithNode<string>;
    architectures?: SequenceWithNode<string>;
}

export interface CharmContainerMount {
    storage?: WithNode<string>;
    location?: WithNode<string>;
}

export interface CharmContainer {
    name: string;
    resource?: WithNode<string>;
    bases?: SequenceWithNode<CharmContainerBase>;
    mounts?: SequenceWithNode<CharmContainerMount>;
}

export interface CharmAssumption {
    single?: WithNode<string>;
    allOf?: SequenceWithNode<string>;
    anyOf?: SequenceWithNode<string>;
}

export interface CharmMetadata {
    name?: WithNode<string>;
    displayName?: WithNode<string>;
    description?: WithNode<string>;
    summary?: WithNode<string>;
    source?: WithNode<string> | SequenceWithNode<string>;
    issues?: WithNode<string> | SequenceWithNode<string>;
    website?: WithNode<string> | SequenceWithNode<string>;
    maintainers?: SequenceWithNode<string>;
    terms?: SequenceWithNode<string>;
    docs?: WithNode<string>;
    subordinate?: WithNode<boolean>;
    requires?: MapWithNode<CharmEndpoint>;
    provides?: MapWithNode<CharmEndpoint>;
    peers?: MapWithNode<CharmEndpoint>;
    resources?: MapWithNode<CharmResource>;
    devices?: MapWithNode<CharmDevice>;
    storage?: MapWithNode<CharmStorage>;
    extraBindings?: MapWithNode<CharmExtraBinding>;
    containers?: MapWithNode<CharmContainer>;
    assumes?: SequenceWithNode<CharmAssumption>;
    customFields?: { [key: string]: any };
    /**
     * Root node.
     */
    node: YAMLNode;
}

export type CharmEventSource = 'endpoints/peer' | 'endpoints/requires' | 'endpoints/provides' | 'storage' | 'container' | 'action' | 'built-in';

export interface CharmEvent {
    name: string;
    source: CharmEventSource;
    /**
     * Name of the action, if the source of this event is an action. 
     */
    sourceActionName?: string;
    symbol: string;
    preferredHandlerSymbol: string;
    description?: string;
}

export interface CharmAction {
    name: string;
    symbol: string;
    description?: WithNode<string>;
}

export interface CharmActions {
    actions?: MapWithNode<CharmAction>;
    /**
     * Root node.
     */
    node: YAMLNode;
}

/*
 * TODO
 * We have skipped AST-scope granularity (e.g., nodes or problems) for tox
 * configuration model, for now. Maybe at some point in future we decided to add
 * them to the type, after which point the type should look like others (e.g.,
 * actions or config ) where WithNode<T> has replaced primitive types.
 */
export interface CharmToxConfig {
    sections: { [key: string]: CharmToxConfigSection };
}

export interface CharmToxConfigSection {
    name: string;
}

export class CharmSourceCodeFile {
    private _analyzer: SourceCodeFileAnalyzer | undefined;
    private _charmAnalyzer: CharmSourceCodeFileAnalyzer | undefined;
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

    /**
     * Returns the charm-aware source code analyzer instance.
     */
    get charmAnalyzer() {
        if (!this._charmAnalyzer) {
            this._charmAnalyzer = new CharmSourceCodeFileAnalyzer(this.analyzer);
        }
        return this._charmAnalyzer;
    }

    get tpm() {
        if (!this._tpm) {
            this._tpm = new TextPositionMapper(this.content);
        }
        return this._tpm;
    }
}

export type CharmSourceCodeTreeEntry = CharmSourceCodeTreeDirectoryEntry | CharmSourceCodeTreeFileEntry;

export interface CharmSourceCodeTree {
    [key: string]: CharmSourceCodeTreeEntry;
}

export interface CharmSourceCodeTreeDirectoryEntry {
    kind: 'directory';
    data: CharmSourceCodeTree;
}

export interface CharmSourceCodeTreeFileEntry {
    kind: 'file';
    data: CharmSourceCodeFile;
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

    /**
     * Returns a flat map of files and their relative path in the source code
     * tree. Note that the results are not ordered in a specific manner.
     */
    getFiles(): Map<string, CharmSourceCodeFile> {
        const result = new Map<string, CharmSourceCodeFile>();

        const stack: [string, CharmSourceCodeTreeEntry][] = [];
        function push(tree: CharmSourceCodeTree, relativePath?: string) {
            stack.push(...Object.entries(tree).map(([k, v]) =>
                [relativePath !== undefined ? relativePath + '/' + k : k, v] as [string, CharmSourceCodeTreeEntry]
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

    isMain(relativePath: string): boolean {
        // TODO: This may not be the exact criteria for the main charm file. 
        return relativePath === CHARM_DIR_SRC_MAIN;
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

export class SourceCodeFileAnalyzer {
    private _classes: SourceCodeClass[] | undefined | null = null;
    private _functions: SourceCodeFunction[] | undefined | null = null;
    readonly tpm: TextPositionMapper;

    constructor(readonly content: string, readonly ast: any | undefined) {
        this.tpm = new TextPositionMapper(this.content);
    }

    /**
     * Resets analyses' results.
     */
    reset() {
        this._classes = null;
        this._functions = null;
    }

    get classes(): SourceCodeClass[] | undefined {
        if (this._classes !== null) {
            return this._classes;
        }
        return this._classes = this._getClasses(this.ast, this.tpm.all());
    }

    get functions(): SourceCodeFunction[] | undefined {
        if (this._functions !== null) {
            return this._functions;
        }
        return this._functions = this._getFunctions(this.ast, this.tpm.all());
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
}

export class CharmSourceCodeFileAnalyzer {
    private _charmClasses: SourceCodeClass[] | undefined | null = null;
    private _mainCharmClass: SourceCodeClass | undefined | null = null;

    constructor(readonly analyzer: SourceCodeFileAnalyzer) { }

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

    private _getCharmClasses(): SourceCodeCharmClass[] | undefined {
        return this.analyzer.classes?.filter(x => x.bases.indexOf(CHARM_SOURCE_CODE_CHARM_BASE_CLASS) !== -1)
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

        const body = this.analyzer.ast?.['body'];
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

            const nodeText = this.analyzer.tpm.getTextOverRange(getNodeRange(x));
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
}

const CHARM_TEST_SOURCE_CODE_UNITTEST_BASE_CLASS = 'TestCase';
const CHARM_TEST_SOURCE_CODE_PYTEST_CLASS_PREFIX = 'Test';
const CHARM_TEST_SOURCE_CODE_TEST_FUNCTION_PREFIX = 'test_';

export class CharmTestSourceCodeFileAnalyzer {
    private _testClasses: SourceCodeCharmTestClass[] | undefined | null = null;
    private _testFunctions: SourceCodeFunction[] | undefined | null = null;

    constructor(readonly analyzer: SourceCodeFileAnalyzer) { }

    /**
     * Resets analyses' results.
     */
    reset() {
        this._testClasses = null;
        this._testFunctions = null;
    }

    get testClasses(): SourceCodeCharmTestClass[] | undefined {
        if (this._testClasses !== null) {
            return this._testClasses;
        }
        return this._testClasses = this._getTestClasses();
    }

    get testFunctions(): SourceCodeFunction[] | undefined {
        if (this._testFunctions !== null) {
            return this._testFunctions;
        }
        return this._testFunctions = this._getTestFunctions();
    }


    private _getTestClasses(): SourceCodeCharmTestClass[] | undefined {
        /**
         * See the Pytest test discovery convention at:
         *   https://docs.pytest.org/en/7.4.x/explanation/goodpractices.html#conventions-for-python-test-discovery 
         */
        const isPytestTestClass = (cls: SourceCodeClass) =>
            cls.name.startsWith(CHARM_TEST_SOURCE_CODE_PYTEST_CLASS_PREFIX)
            && !cls.methods.find(x => x.name === NODE_NAME_FUNCTION_INIT); // No init/constructor method.
        const isUnittestTestClass = (cls: SourceCodeClass) =>
            cls.bases.some(x => x === CHARM_TEST_SOURCE_CODE_UNITTEST_BASE_CLASS);

        return this.analyzer.classes?.filter(x => isUnittestTestClass(x) || isPytestTestClass(x))
            .map(x => ({
                dialect: isUnittestTestClass(x) ? 'unittest.TestCase' : 'pytest',
                testMethods: x.methods.filter(y => this._isTestFunction(y)),
                ...x,
            }));
    }

    private _isTestFunction(fn: SourceCodeFunction): boolean {
        return fn.name.startsWith(CHARM_TEST_SOURCE_CODE_TEST_FUNCTION_PREFIX);
    }

    private _getTestFunctions(): SourceCodeFunction[] | undefined {
        return this.analyzer.functions?.filter(y => this._isTestFunction(y));
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

const REGEXP_SPECIAL_CHARS = /[/\-\\^$*+?.()|[\]{}]/g;
export function escapeRegex(s: string): string {
    return s.replace(REGEXP_SPECIAL_CHARS, '\\$&');
}

export type DeepSearchCallbackNode = { kind: 'object'; value: object } | { kind: 'array'; value: Array<any> };
export type DeepSearchCallback = (key: any, node: DeepSearchCallbackNode) => boolean | DeepSearchCallback;

export function deepSearch(node: any, callback: DeepSearchCallback) {
    _deepSearch([node], callback);
    function _deepSearch(node: any, callback: DeepSearchCallback) {
        if (typeof node !== 'object') {
            return;
        }
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const element = node[i];
                if (typeof element !== 'object') {
                    continue;
                }
                const arg: DeepSearchCallbackNode = Array.isArray(element) ? { kind: 'array', value: element } : { kind: 'object', value: element };
                const dig = callback(i, arg);
                if (dig === false) {
                    continue;
                }
                const nextCallback = dig === true ? callback : dig;
                _deepSearch(element, nextCallback);
            }
        } else {
            for (const key in node) {
                const value = node[key];
                if (typeof value !== 'object') {
                    continue;
                }
                const arg: DeepSearchCallbackNode = Array.isArray(value) ? { kind: 'array', value: value } : { kind: 'object', value: value };
                const dig = callback(key, arg);
                if (dig === false) {
                    continue;
                }
                const nextCallback = dig === true ? callback : dig;
                _deepSearch(value, nextCallback);
            }
        }
    }
}

export function deepSearchForPattern(node: any, pattern: any): any | undefined {

}

function withReference(text: string, ...urls: string[]): string {
    return `${text}\n\n*Reference(s):*\n${urls.map(x => `  - ${x}`).join('\n')}`;
}

const CHARM_LIFECYCLE_EVENTS: CharmEvent[] = [
    Object.freeze({ source: 'built-in', name: 'start', symbol: 'start', preferredHandlerSymbol: '_on_start', description: withReference('Fired as soon as the unit initialization is complete.', 'https://juju.is/docs/sdk/start-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'config-changed', symbol: 'config_changed', preferredHandlerSymbol: '_on_config_changed', description: withReference('Fired whenever the cloud admin changes the charm configuration *.', 'https://juju.is/docs/sdk/config-changed-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'install', symbol: 'install', preferredHandlerSymbol: '_on_install', description: withReference('Fired when juju is done provisioning the unit.', 'https://juju.is/docs/sdk/install-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'leader-elected', symbol: 'leader_elected', preferredHandlerSymbol: '_on_leader_elected', description: withReference('Fired on the new leader when juju elects one.', 'https://juju.is/docs/sdk/leader-elected-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'leader-settings-changed', symbol: 'leader_settings_changed', preferredHandlerSymbol: '_on_leader_settings_changed', description: withReference('Fired on all follower units when a new leader is chosen.', 'https://juju.is/docs/sdk/leader-settings-changed-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'pre-series-upgrade', symbol: 'pre_series_upgrade', preferredHandlerSymbol: '_on_pre_series_upgrade', description: withReference('Fired before the series upgrade takes place.', 'https://juju.is/docs/sdk/pre-series-upgrade-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'post-series-upgrade', symbol: 'post_series_upgrade', preferredHandlerSymbol: '_on_post_series_upgrade', description: withReference('Fired after the series upgrade has taken place.', 'https://juju.is/docs/sdk/post-series-upgrade-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'stop', symbol: 'stop', preferredHandlerSymbol: '_on_stop', description: withReference('Fired before the unit begins deprovisioning.', 'https://juju.is/docs/sdk/stop-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'remove', symbol: 'remove', preferredHandlerSymbol: '_on_remove', description: withReference('Fired just before the unit is deprovisioned.', 'https://juju.is/docs/sdk/remove-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'update-status', symbol: 'update_status', preferredHandlerSymbol: '_on_update_status', description: withReference('Fired automatically at regular intervals by juju.', 'https://juju.is/docs/sdk/update-status-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'upgrade-charm', symbol: 'upgrade_charm', preferredHandlerSymbol: '_on_upgrade_charm', description: withReference('Fired when the cloud admin upgrades the charm.', 'https://juju.is/docs/sdk/upgrade-charm-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'collect-metrics', symbol: 'collect_metrics', preferredHandlerSymbol: '_on_collect_metrics', description: withReference('(deprecated, will be removed soon)', 'https://juju.is/docs/sdk/collect-metrics-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
];

const CHARM_SECRET_EVENTS: CharmEvent[] = [
    Object.freeze({ source: 'built-in', name: 'secret-changed', symbol: 'secret_changed', preferredHandlerSymbol: '_on_secret_changed', description: withReference('The `secret-changed` event is fired on all units observing a secret after the owner of a secret has published a new revision for it.', 'https://juju.is/docs/sdk/event-secret-changed', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'secret-expired', symbol: 'secret_expired', preferredHandlerSymbol: '_on_secret_expired', description: withReference('If a secret was added with the expire argument set to some future time, when that time elapses, Juju will notify the owner charm that the expiration time has been reached by firing a `secret-expired` event on the owner unit.', 'https://juju.is/docs/sdk/event-secret-expired', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'secret-remove', symbol: 'secret_remove', preferredHandlerSymbol: '_on_secret_remove', description: withReference('The `secret-remove` event is fired on the owner of a secret when either:\n  - All observers tracking a now-outdated revision have updated to tracking a newer one, so the old revision can be removed.\n  - No observer is tracking an intermediate revision, and a newer one has already been created. So there is a orphaned revision which no observer will ever be able to peek or update to, because there is already a newer one the observer would get instead.', 'https://juju.is/docs/sdk/event-secret-remove', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'secret-rotate', symbol: 'secret_rotate', preferredHandlerSymbol: '_on_secret_rotate', description: withReference('The `secret-rotate` event is fired on the owner of a secret every time the rotation period elapses (and the event will keep firing until the owner rotates the secret).', 'https://juju.is/docs/sdk/event-secret-rotate', 'https://juju.is/docs/sdk/a-charms-life',) }),
];

const CHARM_RELATION_EVENTS_TEMPLATE = (endpoint: CharmEndpoint, source: CharmEventSource): CharmEvent[] => {
    return [
        { suffix: '-relation-broken', description: withReference('`relation-broken` is a "teardown" event and is emitted when an existing relation between two applications is fully terminated.', 'https://juju.is/docs/sdk/relation-name-relation-broken-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-changed', description: withReference('`relation-changed` is emitted when another unit involved in the relation (from either side) touches the relation data.', 'https://juju.is/docs/sdk/relation-name-relation-changed-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-created', description: withReference('`relation-created` is a "setup" event and, emitted when an application is related to another. Its purpose is to inform the newly related charms that they are entering the relation.', 'https://juju.is/docs/sdk/relation-name-relation-created-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-departed', description: withReference('`relation-departed` is a "teardown" event, emitted when a remote unit departs a relation. This event is the exact inverse of `relation-joined`.', 'https://juju.is/docs/sdk/relation-name-relation-departed-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-joined', description: withReference('`relation-joined` is emitted when a unit joins in an existing relation. The unit will be a local one in the case of peer relations, a remote one otherwise.', 'https://juju.is/docs/sdk/relation-name-relation-joined-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
    ].map(({ suffix, description }) => {
        const name = endpoint.name + suffix;
        const symbol = toValidSymbol(name);
        return {
            name,
            source,
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
        };
    });
};

const CHARM_STORAGE_EVENTS_TEMPLATE = (storage: CharmStorage): CharmEvent[] => {
    return [
        { suffix: '-storage-attached', description: withReference('The event informs a charm that a storage volume has been attached, and is ready to interact with.', 'https://juju.is/docs/sdk/storage-name-storage-attached-event', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-storage-detaching', description: withReference('The event allows a charm to perform cleanup tasks on a storage volume before that storage is dismounted and possibly destroyed.', 'https://juju.is/docs/sdk/storage-name-storage-detaching-event', 'https://juju.is/docs/sdk/a-charms-life',) },
    ].map(({ suffix, description }) => {
        const name = storage.name + suffix;
        const symbol = toValidSymbol(name);
        return {
            name,
            source: 'storage',
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
        };
    });
};

const CHARM_CONTAINER_EVENTS_TEMPLATE = (container: CharmContainer): CharmEvent[] => {
    return [
        { suffix: '-pebble-ready', description: withReference('The event is emitted once the Pebble sidecar container has started and a socket is available.', 'https://juju.is/docs/sdk/container-name-pebble-ready-event', 'https://juju.is/docs/sdk/a-charms-life',) },
    ].map(({ suffix, description }) => {
        const name = container.name + suffix;
        const symbol = toValidSymbol(name);
        return {
            name,
            source: 'container',
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
        };
    });
};

const CHARM_ACTION_EVENT_TEMPLATE = (action: CharmAction): CharmEvent[] => {
    return [
        {
            source: 'action',
            name: `${action.name}-action`,
            symbol: `${action.symbol}_action`,
            sourceActionName: action.name,
            preferredHandlerSymbol: `_on_${action.symbol}_action`,
            description: (action.description?.value !== undefined ? action.description.value + '\n\n' : '') + `Fired when \`${action.name}\` action is called.`,
        }
    ];
};

export function emptyYAMLNode(): YAMLNode {
    return {
        text: '',
        raw: {},
        problems: [],
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    };
}

export function emptyActions(): CharmActions {
    return {
        node: emptyYAMLNode(),
    };
}

export function emptyConfig(): CharmConfig {
    return {
        node: emptyYAMLNode(),
    };
}

export function emptyMetadata(): CharmMetadata {
    return {
        node: emptyYAMLNode(),
    };
}

export function emptyToxConfig(): CharmToxConfig {
    return {
        sections: {},
    };
}

export class Charm {
    private _config: CharmConfig = emptyConfig();

    private _eventSymbolMap = new Map<string, CharmEvent>();
    private _actions: CharmActions = emptyActions();
    private _metadata: CharmMetadata = emptyMetadata();
    private _toxConfig: CharmToxConfig = emptyToxConfig();

    private _events: CharmEvent[] = [];
    private _src: CharmSourceCode = new CharmSourceCode({});

    constructor() { }

    get config(): CharmConfig {
        return this._config;
    }

    get actions(): CharmActions {
        return this._actions;
    }

    get events(): CharmEvent[] {
        return this._events;
    }

    getEventBySymbol(symbol: string): CharmEvent | undefined {
        return this._eventSymbolMap.get(symbol);
    }

    get metadata(): CharmMetadata {
        return this._metadata;
    }

    get toxConfig(): CharmToxConfig {
        return this._toxConfig;
    }

    get src(): CharmSourceCode {
        return this._src;
    }

    async updateActions(actions: CharmActions) {
        this._actions = actions;
        this._repopulateEvents();
    }

    async updateConfig(config: CharmConfig) {
        this._config = config;
    }

    async updateMetadata(metadata: CharmMetadata) {
        this._metadata = metadata;
        this._repopulateEvents();
    }

    async updateToxConfig(toxConfig: CharmToxConfig) {
        this._toxConfig = toxConfig;
    }

    async updateSourceCode(src: CharmSourceCode) {
        this._src = src;
    }

    private _repopulateEvents() {
        this._events = [
            ...Array.from(CHARM_LIFECYCLE_EVENTS),
            ...Array.from(CHARM_SECRET_EVENTS),
            ...Object.entries(this._actions.actions?.entries ?? {}).filter(([, action]) => action.value).map(([, action]) => CHARM_ACTION_EVENT_TEMPLATE(action.value!)).flat(1),
            ...Object.entries(this._metadata.storage?.entries ?? {}).filter(([, storage]) => storage.value).map(([, storage]) => CHARM_STORAGE_EVENTS_TEMPLATE(storage.value!)).flat(1),
            ...Object.entries(this._metadata.containers?.entries ?? {}).filter(([, container]) => container.value).map(([, container]) => CHARM_CONTAINER_EVENTS_TEMPLATE(container.value!)).flat(1),
            ...Object.entries(this._metadata.peers?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => CHARM_RELATION_EVENTS_TEMPLATE(endpoint.value!, 'endpoints/peer')).flat(1),
            ...Object.entries(this._metadata.provides?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => CHARM_RELATION_EVENTS_TEMPLATE(endpoint.value!, 'endpoints/provides')).flat(1),
            ...Object.entries(this._metadata.requires?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => CHARM_RELATION_EVENTS_TEMPLATE(endpoint.value!, 'endpoints/requires')).flat(1),
        ];

        this._eventSymbolMap.clear();
        for (const e of this._events) {
            this._eventSymbolMap.set(e.symbol, e);
        }
    }
}

