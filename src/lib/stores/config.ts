import { writable, get } from 'svelte/store';

export interface GameConfig {
	crashMode: string;
	crashMin: number;
	crashRange: number;
	crashBonusChance: number;
	crashBonusMax: number;
	betTime: number;
	explodeTime: number;
	crashWait: number;
	multSpeed: number;
	multAccel: number;
	tokenMax: number;
	tokenSpawnRate: number;
	tokenBoost: number;
	tokenVals: string;
	tokenWeights: string;
	bhMax: number;
	bhSpawnRate: number;
	bhMinMult: number;
	bhGravity: number;
	bhVals: string;
	bhWeights: string;
	startBal: number;
	betMin: number;
	betMax: number;
	winCap: number;
	_tokenVals: number[];
	_tokenWeights: number[];
	_bhVals: number[];
	_bhWeights: number[];
}

const defaults: GameConfig = {
	crashMode: 'easy',
	crashMin: 8,
	crashRange: 20,
	crashBonusChance: 40,
	crashBonusMax: 50,
	betTime: 6,
	explodeTime: 2.2,
	crashWait: 3,
	multSpeed: 0.002,
	multAccel: 0.00036,
	tokenMax: 25,
	tokenSpawnRate: 4,
	tokenBoost: 40,
	tokenVals: '1.1,1.2,1.5,2.0,3.0,5.0,7.0,10.0',
	tokenWeights: '20,20,20,15,12,7,4,2',
	bhMax: 8,
	bhSpawnRate: 0.8,
	bhMinMult: 2,
	bhGravity: 250,
	bhVals: '5,10,15,20,30,50,100',
	bhWeights: '20,25,20,15,10,7,3',
	startBal: 1000,
	betMin: 0.1,
	betMax: 100,
	winCap: 10000,
	_tokenVals: [1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 7.0, 10.0],
	_tokenWeights: [20, 20, 20, 15, 12, 7, 4, 2],
	_bhVals: [5, 10, 15, 20, 30, 50, 100],
	_bhWeights: [20, 25, 20, 15, 10, 7, 3]
};

function loadFromStorage(): Partial<GameConfig> {
	try {
		const s = localStorage.getItem('mma_admin_config');
		return s ? JSON.parse(s) : {};
	} catch {
		return {};
	}
}

function parseArrays(cfg: GameConfig) {
	cfg._tokenVals = (cfg.tokenVals || '')
		.split(',')
		.map(Number)
		.filter((n) => n > 0);
	cfg._tokenWeights = (cfg.tokenWeights || '')
		.split(',')
		.map(Number)
		.filter((n) => n > 0);
	cfg._bhVals = (cfg.bhVals || '')
		.split(',')
		.map(Number)
		.filter((n) => n > 0);
	cfg._bhWeights = (cfg.bhWeights || '')
		.split(',')
		.map(Number)
		.filter((n) => n > 0);
	if (!cfg._tokenVals.length) {
		cfg._tokenVals = [1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 7.0, 10.0];
		cfg._tokenWeights = [20, 20, 20, 15, 12, 7, 4, 2];
	}
	if (!cfg._bhVals.length) {
		cfg._bhVals = [5, 10, 15, 20, 30, 50, 100];
		cfg._bhWeights = [20, 25, 20, 15, 10, 7, 3];
	}
}

const saved = loadFromStorage();
const initial = { ...defaults, ...saved };
parseArrays(initial);

export const config = writable<GameConfig>(initial);

export function updateConfig(parsed: Partial<GameConfig>) {
	config.update((cfg) => {
		const updated = { ...cfg, ...parsed };
		parseArrays(updated);
		return updated;
	});
}
