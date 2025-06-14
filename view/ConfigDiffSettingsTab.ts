import ModuleConfigEnginePlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class ConfigDiffSettingsTab extends PluginSettingTab {
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