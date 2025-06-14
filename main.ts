import { Plugin } from 'obsidian';
import { CONFIG_ALL_DIFF_VIEW_TYPE, ConfigAllDiffView } from 'view/ConfigAllDiffView';
import { ConfigDiffSettingsTab } from 'view/ConfigDiffSettingsTab';

interface ModuleConfigEngineSettings {
	autoRefresh: boolean;
	refreshInterval: number;
}

const DEFAULT_SETTINGS: ModuleConfigEngineSettings = {
	autoRefresh: true,
	refreshInterval: 5,
};

export default class ModuleConfigEnginePlugin extends Plugin {
	settings: ModuleConfigEngineSettings;
	private refreshIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(
			CONFIG_ALL_DIFF_VIEW_TYPE,
			(leaf) => new ConfigAllDiffView(leaf, this)
		);

		// Add command to open diff view
		this.addCommand({
			id: 'open-config-diff',
			name: 'Open Config Diff View',
			callback: () => this.activateView()
		});

		// Add settings tab
		this.addSettingTab(new ConfigDiffSettingsTab(this.app, this));

		// Start auto-refresh if enabled
		if (this.settings.autoRefresh) {
			this.startAutoRefresh();
		}
	}

	onunload() {
		if (this.refreshIntervalId) {
			window.clearInterval(this.refreshIntervalId);
		}
		this.app.workspace.detachLeavesOfType(CONFIG_ALL_DIFF_VIEW_TYPE);
	}

	async activateView() {
		if (this.app.workspace.getLeavesOfType(CONFIG_ALL_DIFF_VIEW_TYPE).length > 0) {
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);
		if (leaf == null) {
			throw new Error("Could not create leaf.");
		}

		await leaf.setViewState({
			type: CONFIG_ALL_DIFF_VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(leaf);
	}

	startAutoRefresh() {
		if (this.refreshIntervalId) {
			window.clearInterval(this.refreshIntervalId);
		}

		this.refreshIntervalId = window.setInterval(() => {
			const leaves = this.app.workspace.getLeavesOfType(CONFIG_ALL_DIFF_VIEW_TYPE);
			leaves.forEach(leaf => {
				const view = leaf.view as ConfigAllDiffView;
				view.refresh();
			});
		}, this.settings.refreshInterval * 1000);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.settings.autoRefresh) {
			this.startAutoRefresh();
		} else if (this.refreshIntervalId) {
			window.clearInterval(this.refreshIntervalId);
			this.refreshIntervalId = null;
		}
	}
}

// todo: only files diff in right leaf
// todo: file content diff in center leaf
// todo: use some git node package instead of cli
// todo: clean up mani file and file structure
// todo: 