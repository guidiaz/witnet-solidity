#!/usr/bin/env node

const execSync = require('child_process').execSync;
const fs = require("fs");
const inquirer = require("inquirer")
const path = require("path")

const utils = require("../utils")
const Witnet = require("../lib/radon");

const witnet_require_path = process.env.WITNET_SOLIDITY_REQUIRE_PATH || "../../../../witnet";
const witnet_solidity_module_path = process.env.WITNET_SOLIDITY_MODULE_PATH || "node_modules/witnet-solidity/witnet";
const witnet_config_file = `${witnet_solidity_module_path}/migrations/settings.js`
const witnet_contracts_path = `${witnet_solidity_module_path}/contracts`
const witnet_migrations_path = `${witnet_solidity_module_path}/migrations/scripts/`
const witnet_tests_path = `${witnet_solidity_module_path}/tests`

if (process.argv.length >= 3) {
    const command = process.argv[2]
    if (command === "init") {
        if (!fs.existsSync(`./witnet/assets/addresses.json`)) {
            // if not yet initialized...
            init();
            if (process.argv.includes("--wizard")) {
                wizard();
            } else {
                version();
                showMainUsage();
            }
        } else {
            // if already initialized...
            wizard();
        }
        
    } else if (command === "avail") {
        avail();
    } else if (command === "test") {
        test();
    } else if (command === "check") {
        check();
    } else if (command === "console") {
        truffleConsole();
    } else if (command === "deploy") {
        deploy();
    } else if (command === "version") {
        version();
    } else {
        version()
        showMainUsage()
    }
} else {
    version()
    showMainUsage()
}

function version(str) {
    console.info(`\x1b[1;34mWitnet Solidity ${str || "utility command"} v${require("../../package.json").version}\x1b[0m`)
}

function showMainUsage() {
    console.info()
    console.info("Usage:")
    console.info()
    console.info("  ", "avail", "\t\t=>", "List available resources from Witnet.")
    console.info("  ", "check", "\t\t=>", "Check that all Witnet assets are properly declared.")
    console.info("  ", "console", "\t\t=>", "Open Truffle console as to interact with Witnet deployed artifacts.")
    console.info("  ", "deploy", "\t\t=>", "Deploy Witnet requests and templates defined within the witnet/assets/ folder.")
    console.info("  ", "test", "\t\t=>", "Dry-run requests and templates defined within the witnet/assets/ folder.")
    console.info("  ", "version", "\t\t=>", "Shows version.")
}

function showAvailUsage() {
    console.info("Usage:")
    console.info()
    console.info("  ", "$ npx witnet avail")
    console.info("  ", "  ", "--chains [<optional-list>]", "\t=>", "List supported sidechains and deployed Witnet artifact addresses within those.")
    console.info("  ", "  ", "--requests [<optional-list>]", "\t=>", "Show details of all Witnet request artifacts currently available for deployment.")
    console.info("  ", "  ", "--templates [<optional-list>]", "\t=>", "Show details of all Witnet template artifacts currently available for deployment.")
    console.info("  ", "  ", "--retrievals [<optional-list>]", "\t=>", "Show details of Witnet data retriving scripts referable from other Witnet artifacts.")
}

async function init() {
    if (!fs.existsSync("./witnet/assets")) {
        fs.mkdirSync("./witnet/assets", { recursive: true })
    }    

    if (!fs.existsSync(".env_witnet")) {
        fs.cpSync("node_modules/witnet-solidity/.env_witnet", ".env_witnet")
    } 
    fs.cpSync("node_modules/witnet-solidity/witnet/assets/_index.js", "./witnet/assets/index.js");
    if (!fs.existsSync("./witnet/assets/requests.js")) {
        fs.cpSync("node_modules/witnet-solidity/witnet/assets/_requests.js", "./witnet/assets/requests.js");
    }
    if (!fs.existsSync("./witnet/assets/retrievals.js")) {
        fs.cpSync("node_modules/witnet-solidity/witnet/assets/_retrievals.js", "./witnet/assets/retrievals.js");
    }
    if (!fs.existsSync("./witnet/assets/templates.js")) {
        fs.cpSync("node_modules/witnet-solidity/witnet/assets/_templates.js", "./witnet/assets/templates.js");
    }
    if (!fs.existsSync("./witnet/assets/templates.js")) {
        fs.cpSync("node_modules/witnet-solidity/witnet/assets/_templates.js", "./witnet/assets/templates.js");
    }
    if (!fs.existsSync("./witnet/assets/addresses.json")) {
        fs.writeFileSync("./witnet/assets/addresses.json", "{}")
    }
}

function avail() {
    
    const addresses = require(`${witnet_require_path}/assets`).addresses;
    const requests = require(`${witnet_require_path}/assets`).requests;
    const retrievals = require(`${witnet_require_path}/assets`).retrievals;
    const templates = require(`${witnet_require_path}/assets`).templates;

    if (process.argv.includes("--chains")) {
        let selection = utils.splitSelectionFromProcessArgv("--chains").map(value => {
            return value.toLowerCase() === "ethereum" ? "default" : value.toLowerCase()
        })
        // add `WITNET_DEFAULT_CHAIN` to selection, should no chains list be provided from CLI
        if ((!selection || selection.length == 0) && process.env.WITNET_DEFAULT_CHAIN) {
            selection = [ process.env.WITNET_DEFAULT_CHAIN.toLowerCase().trim().replaceAll(":", ".") ]
        }
        if (!selection || selection.length == 0) {
            // if no chains list was specified, just list Witnet supported "ecosystems"
            utils.traceHeader("WITNET SUPPORTED ECOSYSTEMS")
            for (let ecosystem in addresses) {
                if (ecosystem === "default") ecosystem = "ethereum"
                console.info("  ", ecosystem.toUpperCase())
            }
            console.info()
            console.info("To get Witnet-supported chains within a list of ecosystems:")
            console.info()
            console.info("  ", "$ npx witnet avail --chains <comma-separated-witnet-supported-ecosystems>")
            console.info()
            console.info("Note: the --chains operand can be omitted if the WITNET_DEFAULT_CHAIN environment variable is set.")
            console.info()
            process.exit(0)
        }
        let found = 0
        for (let ecosystem in addresses) {
            if (selection.includes(ecosystem)) {
                found ++
                // if ecosystem matches any of selection items, 
                // print Witnet supported "chains" within it
                const caption = ecosystem === "default" ? "ETHEREUM" : ecosystem.toUpperCase()
                utils.traceHeader(`SUPPORTED '${caption}' CHAINS`)
                for (const network in addresses[ecosystem]) {
                    console.info("  ", network.replaceAll(".", ":"))
                }
                console.info()
                console.info("To get Witnet artifact addresses within one or more chains:")
                console.info()
                console.info("  ", "$ npx witnet avail --chains <comma-separated-witnet-supported-chains> [--artifacts <comma-separated-witnet-artifact-names>]")
                console.info()
                console.info("Principal Witnet artifact addresses will be shown if no artifact name list is specified.")
                console.info()
            } else {
                // otherwise, search for selection matches with any chain within this ecosystem
                for (let network in addresses[ecosystem]) {
                    if (selection.length == 0 || selection.includes(network)) {
                        found ++
                        utils.traceHeader(`WITNET ARTIFACTS ON '${network.replaceAll(".", ":").toUpperCase()}'`)
                        if (_traceWitnetAddresses(addresses[ecosystem][network], utils.getWitnetArtifactsFromArgs()) == 0) {
                            console.info("  ", "Unavailable.")
                        }
                    }
                }   
            }
        }
        if (!found) {
            console.info()
            console.info("Sorry, no entries found for chains: ", selection)
        }
    } else if (process.argv.includes("--requests")) {
        const selection = utils.splitSelectionFromProcessArgv("--requests")
        if (selection.length == 0) {
            utils.traceHeader("WITNET DATA REQUESTS")
            _traceWitnetArtifactsBreakdown(requests)
        }
        if (selection.length == 0 || !_traceWitnetArtifacts(requests, selection)) {
            console.info()
            console.info("To delimit tree breakdown, or show the specs of a group of leafs:")
            console.info()
            console.info("  ", "$ npx witnet avail --retrievals <comma-separated-unique-resource-names>")
            console.info()
        }
    } else if (process.argv.includes("--templates")) {
        const selection = utils.splitSelectionFromProcessArgv("--templates")   
        if (selection.length == 0) {
            utils.traceHeader("WITNET DATA REQUEST TEMPLATES")
            _traceWitnetArtifactsBreakdown(templates)
        }
        if (selection.length == 0 || !_traceWitnetArtifacts(templates, selection)) {
            console.info()
            console.info("To delimit tree breakdown, or show the specs of a group of leafs:")
            console.info()
            console.info("  ", "$ npx witnet avail --retrievals <comma-separated-unique-resource-names>")
            console.info()
        }
    } else if (process.argv.includes("--retrievals")) {
        const selection = utils.splitSelectionFromProcessArgv("--retrievals")
        if (selection.length == 0) {
            utils.traceHeader("WITNET RETRIEVALS")
            __traceWitnetRetrievalsBreakdown(retrievals)
            console.info()
            console.info("To delimit tree breakdown, or show the specs of a group of leafs:")
            console.info()
            console.info("  ", "$ npx witnet avail --retrievals <comma-separated-unique-resource-names>")
            console.info()
        } else {
            const dict = utils.dictionary(Object, retrievals)
            for (const index in selection) {
                const key = selection[index]
                try {
                    const retrieval = dict[key]
                    if (retrieval?.method) {
                        console.info("\n  ", `\x1b[1;37m${key}\x1b[0m`)
                        console.info("  ", "=".repeat(key.length))
                        _traceWitnetRetrieval(retrieval)
                    } else {
                        console.info("\n  ", `\x1b[1;37m${key}\x1b[0m`)
                        console.info("  ", "=".repeat(key.length))
                        __traceWitnetRetrievalsBreakdown(retrieval)
                    }
                } catch (ex) {
                    console.info("\n  ", `\x1b[1;31m${key}\x1b[0m`)
                    console.info("  ", "=".repeat(key.length))
                    console.info("  ", ">", ex.toString().split('\n')[0])
                }
            }
        }
    } else {
        showAvailUsage();
    }
}

function check() {
    utils.traceHeader(`Checking Witnet assets...`)
    const [ requests, templates, retrievals ] = [
        utils.countLeaves(Witnet.Artifacts.Class, require(`${witnet_require_path}/assets`).requests),
        utils.countLeaves(Witnet.Artifacts.Template, require(`${witnet_require_path}/assets`).templates),
        utils.countLeaves(Witnet.Retrievals.Class, require(`${witnet_require_path}/assets`).retrievals)
    ];
    if (requests) console.info("  ", "> Requests:  ", requests);
    if (templates) console.info("  ", "> Templates: ", templates);
    if (retrievals) console.info("  ", "> Retrievals:", retrievals);
    console.info("\nAll assets checked successfully!")
}

function test() {
    let oIndex = -1
    process.argv.map((value, index) => {
        if (value.startsWith("--") && oIndex === -1) {
            oIndex = index
        }
    })
    const args = (oIndex >= 0) ? process.argv.slice(oIndex).join(" ") : ""
    try {
        execSync(`npx truffle test --compile-none --config ${witnet_config_file} --contracts_directory ${witnet_contracts_path} --migrations_directory ${witnet_migrations_path} ${witnet_tests_path}/witnet.templates.spec.js ${witnet_tests_path}/witnet.requests.spec.js ${args}`, { stdio: 'inherit' })
    } catch {}
    if (!process.argv.includes("--artifacts")) {
        console.info("Notes")
        console.info("=====")
        console.info("> You may restrict list of templates and/or requests to be tested:")
        console.info()
        console.info("  $ npx witnet test --artifacts <comma-separated-artifact-names> [--verbose]")
        console.info()
    }
}

function truffleConsole() {
    let chain
    if (process.argv.length > 3 && !process.argv[3].startsWith("-")) {
        chain = utils.getRealmNetworkFromString(process.argv[3].toLowerCase().trim().replaceAll(":", "."))
    } else if (process.env.WITNET_DEFAULT_CHAIN) {
        chain = utils.getRealmNetworkFromString(process.env.WITNET_DEFAULT_CHAIN.toLowerCase().trim().replaceAll(":", "."))
    } else {
        console.info()
        console.info("Usage:")
        console.info()
        console.info("  $ npx witnet console <witnet-supported-chain>")
        console.info()
        console.info("To get a list of <witnet-supported-chain>:")
        console.info()
        console.info("  $ npx witnet avail --chains")
        console.info()
        console.info("No need to specify <witnet-supported-chain> if WITNET_DEFAULT_CHAIN environment variable is set, though.")
        console.info("However, if <witnet-supported-chain> is specified, that will always prevail upon the value of WITNET_DEFAULT_CHAIN.")
        process.exit(0)
    }
    const addresses = require(`${witnet_require_path}/assets`)?.addresses[chain[0]][chain[1]]
    utils.traceHeader(`WITNET ARTIFACTS ON '${chain[1].replaceAll(".", ":").toUpperCase()}'`)
    if (_traceWitnetAddresses(addresses, []) == 0) {
        console.info("  ", "None available.")
    }
    try {
        execSync(`npx truffle console --config ${witnet_config_file} --contracts_directory ${witnet_contracts_path} --migrations_directory ${witnet_migrations_path} --network ${chain[1]}`, { stdio: 'inherit' })
    } catch {}
}

function deploy() {
    let chain
    if (process.argv.length > 3 && !process.argv[3].startsWith("-")) {
        chain = utils.getRealmNetworkFromString(process.argv[3].toLowerCase().trim().replaceAll(":", "."))
    } else if (process.env.WITNET_DEFAULT_CHAIN) {
        chain = utils.getRealmNetworkFromString(process.env.WITNET_DEFAULT_CHAIN.toLowerCase().trim().replaceAll(":", "."))
    } else {
        console.info()
        console.info("Usage:")
        console.info()
        console.info("  $ npx witnet deploy <witnet-supported-chain> --artifacts <comma-separated-artifacts-to-be-deployed>")
        console.info()
        console.info("To get a list of <witnet-supported-chain>:")
        console.info()
        console.info("  $ npx witnet avail --chains")
        console.info()
        console.info("No need to specify <witnet-supported-chain> if WITNET_DEFAULT_CHAIN environment variable is set, though.")
        console.info("However, if <witnet-supported-chain> is specified, that will always prevail upon the value of WITNET_DEFAULT_CHAIN.")
        process.exit(0)
    }   
    let oIndex = -1
    process.argv.map((value, index) => {
        if (value.startsWith("--") && oIndex === -1) {
            oIndex = index
        }
    })
    const args = (oIndex >= 0) ? process.argv.slice(oIndex).join(" ") : ""
    try {
        execSync(`npx truffle migrate --config ${witnet_config_file} --contracts_directory ${witnet_contracts_path} --migrations_directory ${witnet_migrations_path} --network ${chain[1]} ${args}`, { stdio: 'inherit' })
    } catch {}    
    if (!process.argv.includes("--artifacts")) {
        console.info("Notes")
        console.info("=====")
        console.info("> Depending on the contents of your migrations/witnet/addresses.json file,")
        console.info("> you may need to specify a list of templates and/or requests to be deployed:")
        console.info()
        console.info("    $ npx witnet deploy [<witnet-supported-chain>] --artifacts <comma-separated-artifact-names>")
        console.info()
      }
}

async function wizard() {
    console.clear()
    version("Wizard")
    console.info()
    var contractName = "";
    var contractPath = "contracts/";
    var firstContract = true;
    var namedByUser = false;
    if (process.argv.includes("--wizard") && process.argv.indexOf("--wizard") < process.argv.length - 1) {
        contractName = process.argv[process.argv.indexOf("--wizard") + 1].toLowerCase();
        if (contractName.indexOf("/") > -1) {
            contractPath = contractName.slice(0, contractName.lastIndexOf("/"))
            contractName = contractName.slice(contranctName.lastIndexOf("/") + 1)
        }
        if (fs.existsSync(contractPath + contractName)) {
            console.info("Sorry, output file already exists:", contractName)
            process.exit(1)
        } else if (!fs.existsSync(contractPath)) {
            fs.mkdirSync(contractPath);
        }
        if (contractName.endsWith(".sol")) contractName = contractName.slice(0, -4)
        contractName = _capitalizeFirstLetterOnly(contractName)
        namedByUser = true
    }
    if (contractName === "") {
        var basename = `${_capitalizeFirstLetterOnly(path.basename(process.cwd()))}Witnet`
        if (!fs.existsSync(contractPath)) {
            fs.mkdirSync(contractPath);
        }
        var files = fs.readdirSync(contractPath).filter(filename => filename.startsWith(basename))
        contractName = `${basename}${files.length + 1}`
        firstContract = files.length === 0
    }
    var answers = {
        ...await inquirer.prompt([{
            type: "rawlist",
            name: "usage",
            message: `What will ${
                    firstContract ? "your first" : (namedByUser ? `the ${contractName}` : `your next`)
                } Solidity contract be using Witnet for?`,
            choices: [
                "Randomness => unmalleable source of entropy.", 
                "Price feeds => based on multiple, reliable and public data sources.",
                "Public data => retrieved from a single or multiple providers on the Internet.",
            ]
        }])
    };
    var appKind = answers.usage.split(" ")[0]
    switch (appKind) {
        case "Randomness": {
            break;
        }
        case "Price": {
            answers = {
                ...await inquirer.prompt({
                    type: "confirm",
                    name: "pull",
                    message: `Would you like to force price updates from this contract?`
                }), ...answers
            }
            break;
        }
        case "Public": {
            answers = {
                ...await inquirer.prompt({
                    type: "list",
                    name: "dynamic",
                    message: `Will the underlying data sources or parameters vary in time`,
                    choices: [
                        "Yes => either the data sources, or some request parameters, will vary in time.",
                        "No => the data sources and parameters will remain constant."
                    ]
                }), ...answers
            }
            if (answers?.dynamic.split(" ")[0] === "Yes") {
                answers = {
                    ...await inquirer.prompt({
                        type: "list",
                        name: "parameterized",
                        message: `Will your contract have to deal with data request parameters?`,
                        choices: [
                            "Yes => my contract will have to process data request parameters onchain.",
                            "No => actual data requests will be provided by some pre-authorized offchain worflow."
                        ]
                    }), ...answers
                }
            }
            if (answers?.dynamic.split(" ")[0] === "No" || answers?.parameterized.split(" ")[0] === "Yes") {
                answers = {
                    ...await inquirer.prompt({
                        type: "list",
                        name: "callbacks",
                        message: `How would you like your contract to read data from the Witnet oracle?`,
                        choices: [
                            "Asynchronously => my contract will eventually read the result from Witnet, if available.",
                            "Synchronously => my contract is to be called as soon as data is reported from Witnet."
                        ]
                    }), ...answers
                }
            }
            break;
        }
    } 
    // console.info()
    if (appKind === "Randomness" || answers?.callbacks?.split(" ")[0] === "Synchronously") {
        var callbackGasLimit
        do {
            callbackGasLimit = parseInt((await inquirer.prompt({
                type: "number",
                name: "callbackGasLimit",
                message: `Please, specify the maximum gas that you expect your Witnet-callback methods to consume:`,
                default: 250000,
            })).callbackGasLimit)
        } while (!callbackGasLimit)
        answers = { callbackGasLimit, ...answers }
    }
    if (
        appKind === "Randomness" || 
        appKind === "Price" || 
        answers?.parameterized?.split(" ")[0] === "Yes"
    ) {
        answers = {
            ...await inquirer.prompt({
                type: "confirm",
                name: "includeMocks",
                message: `Do you intend to include this new contract within your unitary Solidity tests?`,
                default: false
            }), ...answers
        }
        if (!answers.includeMocks) {
            const addresses = require(`${witnet_require_path}/assets`).addresses
            const choices = []
            for (const ecosystem in addresses) {
                choices.push(ecosystem === "default" ? "ETHEREUM" : ecosystem.toUpperCase())
            }
            answers = {
                ...await inquirer.prompt({
                    type: "checkbox",
                    name: "ecosystems",
                    message: `Please, select the ecosystem(s) where you intend to deploy this new contract:`,
                    choices, pageSize: 16, loop: true,
                    validate: (ans) => { return (ans.length > 0) }
                }), ...answers
            }
            var target = appKind === "Price" ? "WitnetPriceFeeds" : "WitnetRequestBoard"
            var findings = []
            for (const index in answers?.ecosystems) {
                var ecosystem = answers?.ecosystems[index].toLowerCase()
                for (const network in addresses[ecosystem]) {
                    var targetAddr = addresses[ecosystem][network][target]
                    if (!findings.includes(targetAddr)) {
                        findings.push(targetAddr)
                    }
                }
            }
            if (findings.length == 1) {
                answers = {
                    ...answers,
                    witnetAddress: findings[0]
                }
            }
        }
    }
    var baseFeeOverhead = 10; // 10 %
    var constructorParams = answers?.witnetAddress ? "" : "WitnetRequestBoard _witnetRequestBoard"
    var importWitnetMocks = answers.includeMocks
        ? `\nimport "witnet-solidity-bridge/contracts/mocks/WitnetMockedRequestBoard.sol";`
        : ""
    ;
    var witnetAddress = answers?.witnetAddress || "_witnetRequestBoard"
    var templateFile = `${witnet_solidity_module_path}/contracts/`
    switch (appKind) {
        case "Randomness": {
            templateFile += "_UsingRandomness.tsol"; 
            break;
        }
        case "Price": {
            constructorParams = answers?.witnetAddr ? "" : "WitnetPriceFeeds _witnetPriceFeeds"
            templateFile += "_UsingPriceFeeds.tsol";
            witnetAddress = answers?.witnetAddress || "_witnetPriceFeeds"
            break;
        }
        case "Public": {
            if (answers?.dynamic.split(" ")[0] === "Yes") {
                if (answers.parameterized.split(" ")[0] === "Yes") {
                    constructorParams = "WitnetRequestTemplate _witnetRequestTemplate"
                    witnetAddress = "_witnetRequestTemplate"
                    templateFile += (answers?.callbacks.split(" ")[0] === "Synchronously"
                        ? "_RequestTemplateConsumer.tsol" 
                        : "_UsingRequestTemplate.tsol"
                    );
                } else {
                    templateFile += "_Consumer.tsol"
                }
            } else {
                constructorParams = "WitnetRequest _witnetRequest"
                witnetAddress = "_witnetRequest"
                templateFile += (answers?.callbacks.split(" ")[0] === "Synchronously"
                    ? "_RequestConsumer.tsol" 
                    : "_UsingRequest.tsol"
                );
            }
            break;
        }
    } 
    var solidity = fs.readFileSync(templateFile, "utf-8")
        .replaceAll("$_importWitnetMocks", importWitnetMocks)
        .replaceAll("$_contractName", contractName)
        .replaceAll("$_constructorParams", constructorParams)
        .replaceAll("$_witnetAddress", witnetAddress)
        .replaceAll("$_baseFeeOverhead", baseFeeOverhead)
        .replaceAll("$_callbackGasLimit", answers.callbackGasLimit)
    ;
    var solidityPathFileName = `${contractPath}${contractName}.sol`
    fs.writeFileSync(solidityPathFileName, solidity)
    console.info()
    console.info("\x1b[1;37mAwesome! Your new contract was just created here:\x1b[0m")
    console.info(`\x1b[35m${contractPath}\x1b[1;35m${contractName}.sol\x1b[0m`)
}


/// ---- internal functions -------------------------------------------------------------------------------------------

function _capitalizeFirstLetterOnly(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function _orderKeys(obj) {
    var keys = Object.keys(obj).sort(function keyOrder(k1, k2) {
        if (k1 < k2) return -1;
        else if (k1 > k2) return +1;
        else return 0;
    });
    var i, after = {};
    for (i = 0; i < keys.length; i++) {
      after[keys[i]] = obj[keys[i]];
      delete obj[keys[i]];
    }
    for (i = 0; i < keys.length; i++) {
      obj[keys[i]] = after[keys[i]];
    }
    return obj;
  }

function _traceWitnetAddresses(addresses, selection, level) {
    let found = 0
    for (const key in _orderKeys(addresses)) {
        if (typeof addresses[key] === "object") {
            found += _traceWitnetAddresses(addresses[key], selection, (level || 0) + 1)
        } else {
            if (
                (selection.length === 0
                    && key !== "Create2Factory"
                    && !key.endsWith("Implementation")
                    && !key.endsWith("Lib")
                    && !key.endsWith("Proxy")
                ) || selection.includes(key)
            ) {
                found ++
                if (level) {
                    console.info("  ", `\x1b[33m${addresses[key]}\x1b[0m`, "\t<=", `\x1b[37m${key}\x1b[0m`);
                } else {
                    console.info("  ", `\x1b[1;33m${addresses[key]}\x1b[0m`, "\t<=", `\x1b[1;37m${key}\x1b[0m`);
                }
            }
        }
    }
    return found
}

function _traceWitnetArtifact(artifact) {
    const specs = artifact?.specs
    if (specs) {
        const args = specs?.args
        if (specs?.retrieve.length == 1) {
            if (specs.retrieve[0]?.argsCount) {
                if (!args || args.length == 0) {
                    console.info("  ", `[1] RETRIEVE:\t\x1b[1;32m${utils.getRequestMethodString(specs.retrieve[0].method)}(\x1b[0;32m<${specs.retrieve[0].argsCount} args>\x1b[1;32m)\x1b[0m`)
                } else {
                    console.info("  ", `[1] RETRIEVE:\t\x1b[1;32m${utils.getRequestMethodString(specs.retrieve[0].method)}(\x1b[0;32m${JSON.stringify(args[0])}\x1b[1;32m\x1b[0m`)
                }
            } else {
                console.info("  ", `[1] RETRIEVE:\t\x1b[1;32m${utils.getRequestMethodString(specs.retrieve[0].method)}()\x1b[0m`)
            }
        } else {
            console.info("  ", `[1] RETRIEVE:`)
        }
        specs?.retrieve.map((value, index) => {
            if (specs?.retrieve.length > 1) {
                if (value?.argsCount) {
                    if (!args[index] || args[index].length == 0) {
                        console.info("  ", `    [#${index}]\t\t\x1b[1;32m${utils.getRequestMethodString(value.method)}(\x1b[0;32m<${value.argsCount} args>\x1b[1;32m)\x1b[0m`)
                    } else {
                        console.info("  ", `    [#${index}]\t\t\x1b[1;32m${utils.getRequestMethodString(value.method)}(\x1b[0;32m${JSON.stringify(args[index])}\x1b[1;32m)\x1b[0m`)
                    }
                } else {
                    console.info("  ", `    [#${index}]\t\t\x1b[1;32m${utils.getRequestMethodString(value.method)}()\x1b[0m`)
                }
            }
            _traceWitnetArtifactRetrieval(value)
        })
        if (specs?.aggregate) {
            console.info("  ", `[2] AGGREGATE:\t\x1b[1;35m${specs.aggregate.toString()}\x1b[0m`)
        }
        if (specs?.tally) {
            console.info("  ", `[3] TALLY:    \t\x1b[1;35m${specs.tally.toString()}\x1b[0m`)
        }
    }
}

function _traceWitnetArtifacts(crafts, selection) {
    const dict = utils.dictionary(Object, crafts)
    let found = 0
    for (const index in selection) {
        const key = selection[index]
        try {
            const artifact = dict[key]
            if (artifact?.specs) {
                console.info(`\n   \x1b[1;37m${key}\x1b[0m`)
                console.info("  ", "=".repeat(key.length))
                _traceWitnetArtifact(artifact)
                found ++
            } else {
                console.info("\n  ", `\x1b[1;37m${key}\x1b[0m`)
                console.info("  ", "=".repeat(key.length))
                _traceWitnetArtifactsBreakdown(artifact)
            }
        } catch (ex) {
            console.info("\n  ", `\x1b[1;31m${key}\x1b[0m`)
            console.info("  ", "=".repeat(key.length))
            console.info("  ", ">", ex.toString().split('\n')[0])
        }
    }
    return found
}

function _traceWitnetArtifactRetrieval(specs) {
    if (specs?.url) {
        console.info("  ", `    > URL:     \t\x1b[32m${specs.url}\x1b[0m`)
    }
    if (specs?.body) {
        console.info("  ", `    > Body:    \t\x1b[32m${specs.body}\x1b[0m`)
    }
    if (
        specs?.headers && !Array.isArray(specs?.headers) 
            || (Array.isArray(specs?.headers) && specs?.headers.length > 0)
    ) {
        console.info("  ", `    > Headers: \t\x1b[32m${JSON.stringify(specs.headers)}\x1b[0m`)
    }
    if (specs?.script) {
        console.info("  ", `    > Script:  \t\x1b[33m${specs?.script.toString()}\x1b[0m`)
    }
}

function __traceWitnetRetrievalsBreakdown(retrievals, level) {
    if (retrievals?.method) return;    
    for (const key in _orderKeys(retrievals)) {
        console.info(" ", " ".repeat(4 * (level || 0)), (retrievals[key]?.method ? `\x1b[32m${key}\x1b[0m` : `\x1b[1;37m${key}\x1b[0m`))
        __traceWitnetRetrievalsBreakdown(retrievals[key], level ? level + 1 : 1)
    }
}

function _traceWitnetArtifactsBreakdown(artifacts, level) {
    if (artifacts?.specs) return;
    for (const key in _orderKeys(artifacts)) {
        console.info(" ", " ".repeat(4 * (level || 0)), (artifacts[key]?.specs ? `\x1b[32m${key}\x1b[0m` : `\x1b[1;37m${key}\x1b[0m`))
        _traceWitnetArtifactsBreakdown(artifacts[key], level ? level + 1 : 1)
    }
}

function _traceWitnetRetrieval(value) {
    if (value?.method) {
        if (value?.argsCount) {
            console.info("  ", `> Method:    \x1b[1;32m${utils.getRequestMethodString(value.method)}(\x1b[0;32m<${value.argsCount} args>\x1b[1;32m)\x1b[0m`)
        } else {
            console.info("  ", `> Method:    \x1b[1;32m${utils.getRequestMethodString(value.method)}()\x1b[0m`)
        }
        if (value?.url) {
            console.info("  ", `> URL:       \x1b[32m${value.url}\x1b[0m`)
        }
        if (value?.body) {
            console.info("  ", `> Body:      \x1b[32m${value.body}\x1b[0m`)
        }
        if (value?.headers && !Array.isArray(value?.headers) || (Array.isArray(value?.headers) && value?.headers.length > 0)) {
            console.info("  ", `> Headers:   \x1b[32m${JSON.stringify(value.headers)}\x1b[0m`)
        }
        if (value?.script) {
            console.info("  ", `> Script:    \x1b[33m${value?.script.toString()}\x1b[0m`)
        }
        if (value?.tuples) {
            console.info("  ", "> Pre-set tuples:")
            const keys = Object.keys(value.tuples)
            keys.map(key => { 
                console.info("  ", `  "${key}" =>`, JSON.stringify(value.tuples[key]))
            })
        }
    }
}
