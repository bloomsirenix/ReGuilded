const ExtensionManager = require("./extension.js");
const { FileWatcher } = require("../utils");
const { join } = require("path");
const { existsSync } = require("fs");

/**
 * Manager that manages ReGuilded's addons
 */
module.exports = class AddonManager extends ExtensionManager {
    /**
     * Manager that manages ReGuilded's addons
     * @param {String} addonsDir Path to the directory that holds addons
     * @param {ReGuilded} reGuilded Instance of ReGuilded that created this manager
     */
    constructor(addonsDir, reGuilded) {
        super(addonsDir);
        this.parent = reGuilded;
    }

    /**
     * Initiates addons for ReGuilded and addon manager
     * @param {String[]} enabled An array of enabled addons.
     */
    init(enabled = []) {
        console.log("Initiating addon manager");
        // Gets a list of addon directories
        const addons = super.getDirs(enabled);
        // Gets every theme directory
        for (let i in addons) {
            const addon = addons[i]
            // Try-catch errors to prevent conflicts with other plugins
            try {
                console.log(`Found addon directory '${addon.name}'`);
                // Gets the path of the addon
                const addonPath = super.getPath(addon.name);
                // Gets path of the main JS file
                const jsPath = join(addonPath, "main.js");
                // If it doesn't have main file, it's not an addon and ignore it
                if(!existsSync(jsPath)) continue
                // Require the main file
                let main = require(jsPath);
                // Check for ESM default module
                if (typeof(main.preinit) !== "function" && main.default) main = main.default;
                
                // Check if the preinit function exists to prevent errors
                if (typeof(main.preinit) === "function") {
                    // Pre-initialize addon
                    main.preinit(this.parent, this);
                    // Sets directory's name
                    main.dirname = addonPath;
                    // Setup watcher
                    main.watcher = new FileWatcher(addonPath, this.reload.bind(this), main.id);
                    // Push it to the list of addons
                    this.all.push(main);
                    // Emit addon load event
                    this.emit("load", main);
                }
                else console.error("Addon has no preinit function or has invalid formatting:", addon.id, '-', addon.name);
            }
            catch (e) {
                console.error("Failed to initialize addon by ID", addon.id, e);
            }
            // Checks if it's the last item
            this.checkLoaded(i, addons.length);
        }
        // Loads all addons
        this.loadAll();
    }
    /**
     * Loads a ReGuilded addon.
     * @param {{id: String, name: String, init: Function, uninit: Function}} addon Addon to load onto Guilded
     */
    load(addon) {
        // Try-catch errors to prevent conflicts with other plugins
        try {
            console.log(`Loading addon by ID`, addon.id);
            addon.init(this.parent, this, this.parent.webpackManager);
        }
        catch (e) {
            console.error("Failed to load addon by ID", addon.id, e);
        }
    }
    /**
     * Unloads/removes a ReGuilded addon.
     * @param {{id: String, name: String, init: Function, uninit: Function}} addon Addon to load onto Guilded
     */
    unload(addon) {
        try {
            console.log("Unloading addon by ID", addon.id);
            addon.uninit();
            
            const cachedModules = Object.keys(require.cache)
                                        .filter(moduleId => moduleId.match(new RegExp(`^${addon.dirname}`)));
            cachedModules.forEach(moduleId => delete require.cache[moduleId]);
        }
        catch (e) {
            console.error("Failed to unload an addon by ID", addon.id, e);
        }
    }
    /**
     * Reloads a ReGuilded addon.
     * @param {{id: String}} id id of addon to reload on Guilded
     */
    reload(id) {
        let addon = this.all.find(addon => addon.id === id);
        if (!addon) addon = { name: `Invalid Addon (${id})`, invalid: true };
        try {
            if(addon.invalid) throw new Error("Not installed or loaded");
            console.log("Reloading addon by ID", id);
            // Unitilize addon
            addon.uninit();
            
            const cachedModules = Object.keys(require.cache)
                                        .filter(moduleId => moduleId.match(new RegExp(`^${addon.dirname}`)));
            cachedModules.forEach(moduleId => delete require.cache[moduleId]);
            // Require main file
            let reloadedAddon = require(join(addon.dirname, "main.js"));
            // Check for ESM default module
            if (typeof(reloadedAddon.preinit) !== "function" && reloadedAddon.default) reloadedAddon = reloadedAddon.default;
            // Check if the preinit function still exists to prevent errors
                if (typeof(reloadedAddon.preinit) === "function") {
                    // Pre-initialize addon
                    reloadedAddon.preinit(this.parent, this);
                    // Initialize addon
                    reloadedAddon.init(this.parent, this, this.parent.webpackManager);
                }
                else console.error("Addon has no preinit function or is formatted invalidly!", addon.name);
        } catch(e) {
            console.error("Addon failed to reload!", addon.name, e);
        }
    }
};
