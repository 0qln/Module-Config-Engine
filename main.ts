import { App, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, FileSystemAdapter } from 'obsidian';
import { html } from 'diff2html';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);
const DIFF_VIEW_TYPE = 'config-diff-view';

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
			DIFF_VIEW_TYPE,
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
		this.app.workspace.detachLeavesOfType(DIFF_VIEW_TYPE);
	}

	async activateView() {
		if (this.app.workspace.getLeavesOfType(DIFF_VIEW_TYPE).length > 0) {
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);
		if (leaf == null) {
			throw new Error("Could not create leaf.");
		}

		await leaf.setViewState({
			type: DIFF_VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(leaf);
	}

	startAutoRefresh() {
		if (this.refreshIntervalId) {
			window.clearInterval(this.refreshIntervalId);
		}

		this.refreshIntervalId = window.setInterval(() => {
			const leaves = this.app.workspace.getLeavesOfType(DIFF_VIEW_TYPE);
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


class ConfigAllDiffView extends ItemView {
	private plugin: ModuleConfigEnginePlugin;
	private gettingDiff = false;

	constructor(leaf: WorkspaceLeaf, plugin: ModuleConfigEnginePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return DIFF_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Config Diff';
	}

	getIcon(): string {
		return 'git-pull-request';
	}

	async onOpen() {
		await this.refresh();
	}

	async onClose() {
	}

	getVaultPath(): string | null {
		let adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return null;
	}

	async refresh() {
		if (this.gettingDiff) return;

		this.gettingDiff = true;
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Configuration Diff' });

		try {
			const vaultPath = this.getVaultPath();
			const configPath = `${vaultPath}/.obsidian`;

			// Initialize Git repo if needed
			const isGitRepo = await this.isGitRepository(configPath);
			if (!isGitRepo) {
				await this.initializeGitRepo(configPath);
				this.contentEl.createEl('p', { text: 'Initialized Git repository for config' });
				return;
			}

			// Get diff
			const diff = await this.getGitDiff(configPath);

			if (!diff) {
				this.contentEl.createEl('p', { text: 'No configuration changes detected' });
				return;
			}

			// Render diff
			this.renderDiff(diff);

		} catch (error) {
			this.contentEl.createEl('p', {
				text: `Error: ${error.message || error}`,
				cls: 'config-diff-error'
			});
			console.error('Config Diff Error:', error);
		} finally {
			this.gettingDiff = false;
		}
	}

	private renderDiff(diff: string) {
		// Generate HTML from diff
		const diffHtml = html(diff, {
			drawFileList: true,
			outputFormat: 'side-by-side',
			matching: 'lines'
		});

		// Create container for diff
		const diffContainer = this.contentEl.createDiv('config-diff-container');
		diffContainer.innerHTML = diffHtml;
	}

	private async isGitRepository(path: string): Promise<boolean> {
		try {
			await exec('git rev-parse --is-inside-work-tree', { cwd: path });
			return true;
		} catch {
			return false;
		}
	}

	private async initializeGitRepo(path: string) {
		await exec('git init', { cwd: path });
		await exec('git add .', { cwd: path });
		await exec('git commit -m "Initial config commit"', { cwd: path });
	}

	private async getGitDiff(path: string): Promise<string> {
		try {
			const { stdout } = await exec('git diff HEAD', { cwd: path });
			return stdout;
		} catch (error) {
			if (error.stderr && error.stderr.includes('no changes added to commit')) {
				return '';
			}
			throw error;
		}
	}
}

class ConfigDiffSettingsTab extends PluginSettingTab {
	plugin: ModuleConfigEnginePlugin;

	constructor(app: App, plugin: ModuleConfigEnginePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Config Diff Settings' });

		new Setting(containerEl)
			.setName('Auto-refresh')
			.setDesc('Automatically refresh the diff view at regular intervals')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Refresh interval (seconds)')
			.setDesc('How often to auto-refresh the diff view')
			.addText(text => text
				.setValue(this.plugin.settings.refreshInterval.toString())
				.onChange(async (value) => {
					if (!isNaN(Number(value))) {
						this.plugin.settings.refreshInterval = Number(value);
						await this.plugin.saveSettings();
					}
				})
				.setDisabled(!this.plugin.settings.autoRefresh));
	}
}


// todo: only files diff in right leaf
// todo: file content diff in center leaf
// todo: use some git node package instead of cli
// todo: clean up mani file and file structure
// todo: 