var HOST = "https://m.1qxs.com";
var DESKTOP_HOST = "https://www.1qxs.com";

// Try to use CONFIG_URL if available
try {
    if (CONFIG_URL) {
        HOST = "https://m." + CONFIG_URL;
        DESKTOP_HOST = "https://www." + CONFIG_URL;
    }
} catch (e) {
    // Use default
}