/* UGN Bedrock deployment configuration.
 * Static site: no secrets, access tokens, API keys, or credentials belong here.
 * For Bedrock status pings deploy gateway/ separately, then set its HTTPS URL.
 * Microsoft auth is NOT implemented or enabled by this configuration.
 */
window.UGN_CONFIG = Object.freeze({
  gatewayUrl: "",
  directoryUrl: "",
  servers: [
    {
      id: "ugn-main",
      name: "Universal Gaming Network",
      description: "Explore the Universal Gaming Network. Connection and status are not yet verified.",
      host: "play.universalgaming.us",
      port: 19132,
      featured: true,
      mode: "Crossplay Network"
    }
  ]
});
