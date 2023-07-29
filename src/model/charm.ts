import { parseCharmActionsYAML } from './actions';
import { parseCharmConfigYAML } from './config';
import { CharmSourceCode } from './src';
import { CharmAction, CharmActions, CharmConfig, CharmConfigParameter, CharmEvent } from './type';

const CHARM_LIFECYCLE_EVENTS: CharmEvent[] = [
    Object.freeze({ name: 'start', symbol: 'start', preferredHandlerSymbol: '_on_start', description: 'Fired as soon as the unit initialization is complete.' }),
    Object.freeze({ name: 'config-changed', symbol: 'config_changed', preferredHandlerSymbol: '_on_config_changed', description: 'Fired whenever the cloud admin changes the charm configuration *.' }),
    Object.freeze({ name: 'install', symbol: 'install', preferredHandlerSymbol: '_on_install', description: 'Fired when juju is done provisioning the unit.' }),
    Object.freeze({ name: 'leader-elected', symbol: 'leader_elected', preferredHandlerSymbol: '_on_leader_elected', description: 'Fired on the new leader when juju elects one.' }),
    Object.freeze({ name: 'leader-settings-changed', symbol: 'leader_settings_changed', preferredHandlerSymbol: '_on_leader_settings_changed', description: 'Fired on all follower units when a new leader is chosen.' }),
    Object.freeze({ name: 'pre-series-upgrade', symbol: 'pre_series_upgrade', preferredHandlerSymbol: '_on_pre_series_upgrade', description: 'Fired before the series upgrade takes place.' }),
    Object.freeze({ name: 'post-series-upgrade', symbol: 'post_series_upgrade', preferredHandlerSymbol: '_on_post_series_upgrade', description: 'Fired after the series upgrade has taken place.' }),
    Object.freeze({ name: 'stop', symbol: 'stop', preferredHandlerSymbol: '_on_stop', description: 'Fired before the unit begins deprovisioning.' }),
    Object.freeze({ name: 'remove', symbol: 'remove', preferredHandlerSymbol: '_on_remove', description: 'Fired just before the unit is deprovisioned.' }),
    Object.freeze({ name: 'update-status', symbol: 'update_status', preferredHandlerSymbol: '_on_update_status', description: 'Fired automatically at regular intervals by juju.' }),
    Object.freeze({ name: 'upgrade-charm', symbol: 'upgrade_charm', preferredHandlerSymbol: '_on_upgrade_charm', description: 'Fired when the cloud admin upgrades the charm.' }),
    Object.freeze({ name: 'collect-metrics', symbol: 'collect_metrics', preferredHandlerSymbol: '_on_collect_metrics', description: '(deprecated, will be removed soon)' }),
];

const CHARM_SECRET_EVENTS = [
    'secret_changed',
    'secret_expired',
    'secret_remove',
    'secret_rotate',
];

const CHARM_RELATION_EVENTS_SUFFIX = [
    `_relation_broken`,
    `_relation_changed`,
    `_relation_created`,
    `_relation_departed`,
    `_relation_joined`,
];

const CHARM_STORAGE_EVENTS_SUFFIX = [
    `_storage_attached`,
    `_storage_detaching`,
];

const CHARM_CONTAINER_EVENT_SUFFIX = [
    '_pebble_ready',
];

const CHARM_ACTION_EVENT_TEMPLATE = (action: CharmAction): CharmEvent[] => {
    return [
        {
            name: `${action.name}-action`,
            symbol: `${action.symbol}_action`,
            preferredHandlerSymbol: `_on_${action.symbol}_action`,
            description: action.description || `Fired when \`${action.name}\` action is called.`,
        }
    ];
};

function _emptyActions() {
    return { actions: [], problems: [] };
}

function _emptyConfig() {
    return { parameters: [], problems: [] };
}

export class Charm {
    private _config: CharmConfig = _emptyConfig();
    private _configMap = new Map<string, CharmConfigParameter>();

    private _actions: CharmActions = _emptyActions();
    private _eventSymbolMap = new Map<string, CharmEvent>();

    private _events: CharmEvent[] = [];
    private _src: CharmSourceCode = new CharmSourceCode({});

    constructor() { }

    get config(): CharmConfig {
        return this._config;
    }

    getConfigParameterByName(name: string): CharmConfigParameter | undefined {
        return this._configMap.get(name);
    }

    get events(): CharmEvent[] {
        return Array.from(this._events);
    }

    getEventBySymbol(symbol: string): CharmEvent | undefined {
        return this._eventSymbolMap.get(symbol);
    }

    get src(): CharmSourceCode {
        return this._src;
    }

    async updateActions(content: string) {
        this._actions = content ? parseCharmActionsYAML(content) : _emptyActions();
        this._repopulateEvents();
    }

    async updateConfig(content: string) {
        this._config = content ? parseCharmConfigYAML(content) : _emptyConfig();
        this._configMap.clear();
        for (const p of this._config.parameters) {
            this._configMap.set(p.name, p);
        }
    }

    async updateSourceCode(src: CharmSourceCode) {
        this._src = src;
    }

    private _repopulateEvents() {
        // TODO include other events
        this._events = [
            ...Array.from(CHARM_LIFECYCLE_EVENTS),
            ...this._actions.actions.map(action => CHARM_ACTION_EVENT_TEMPLATE(action)).flat(1),
        ];

        this._eventSymbolMap.clear();
        for (const e of this._events) {
            this._eventSymbolMap.set(e.symbol, e);
        }
    }
}

