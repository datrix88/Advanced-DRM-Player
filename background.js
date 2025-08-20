const DNR_RULE_ID_HEADERS = 1;

async function clearDnrRules(ruleIdsToRemove) {
    try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        const finalRuleIdsToRemove = ruleIdsToRemove.filter(id => existingRuleIds.includes(id));

        if (finalRuleIdsToRemove.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: finalRuleIdsToRemove
            });
        }
    } catch (e) {
        if (e.message && !e.message.toLowerCase().includes("rule with id") && !e.message.toLowerCase().includes("not found")) {
            console.warn("[DNR Background] Error al limpiar reglas DNR:", e.message);
        }
    }
}

chrome.runtime.onStartup.addListener(async () => {
    await clearDnrRules([DNR_RULE_ID_HEADERS]);
});

chrome.runtime.onInstalled.addListener(async (details) => {
    await clearDnrRules([DNR_RULE_ID_HEADERS]);
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        const playerUrl = chrome.runtime.getURL("player.html");
        chrome.tabs.create({ url: playerUrl });
    }
});

chrome.action.onClicked.addListener((tab) => {
    const playerUrl = chrome.runtime.getURL("player.html");
    chrome.tabs.query({ url: playerUrl }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { active: true });
            if (tabs[0].windowId) {
                chrome.windows.update(tabs[0].windowId, { focused: true });
            }
        } else {
            chrome.tabs.create({ url: playerUrl });
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.cmd === "updateHeadersRules") {
        const headersToSet = request.requestHeaders || [];
        let effectiveUrlFilter = "*://*/*";
        if (request.urlFilter) {
            effectiveUrlFilter = request.urlFilter;
        }

        let initiatorDomainsCondition = {};
        if (request.initiatorDomain) {
            initiatorDomainsCondition.initiatorDomains = [request.initiatorDomain];
        }

        clearDnrRules([DNR_RULE_ID_HEADERS]).then(async () => {
            if (headersToSet.length > 0) {
                const newRequestHeadersDNR = headersToSet.map(h => ({
                    header: h.header,
                    operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: String(h.value)
                }));

                const newRuleCondition = {
                    urlFilter: effectiveUrlFilter,
                    resourceTypes: Object.values(chrome.declarativeNetRequest.ResourceType)
                };

                if (initiatorDomainsCondition.initiatorDomains && initiatorDomainsCondition.initiatorDomains.length > 0) {
                    newRuleCondition.initiatorDomains = initiatorDomainsCondition.initiatorDomains;
                }

                const newRule = {
                    id: DNR_RULE_ID_HEADERS,
                    priority: 1,
                    action: {
                        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                        requestHeaders: newRequestHeadersDNR
                    },
                    condition: newRuleCondition
                };
                chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: [newRule]
                }, async () => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ success: true });
                    }
                });
            } else {
                sendResponse({ success: true, message: "No hay cabeceras para aplicar, solo se limpiaron reglas." });
            }
        }).catch(error => {
            sendResponse({ success: false, error: "Error al limpiar reglas previas: " + error.message });
        });
        return true;
    }

    if (request.cmd === "clearAllDnrHeaders") {
        clearDnrRules([DNR_RULE_ID_HEADERS])
            .then(async () => {
                sendResponse({ success: true, message: "Reglas DNR limpiadas." });
            })
            .catch(error => {
                sendResponse({ success: false, error: "Error limpiando reglas: " + error.message });
            });
        return true;
    }
    return false;
});