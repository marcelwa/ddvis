
//################### J-QUERY ELEMENTS ###############################################################################################################

const step_duration = $('#stepDuration');
const algo_div = $('#algo_div');
const qdd_div = $('#qdd_div');
const qdd_text = $('#qdd_text');

const cb_colored = $('#cb_colored');
const cb_edge_labels = $('#cb_edge_labels');
const cb_classic = $('#cb_classic');


//################### CONFIGURATION ##################################################################################################################

let stepDuration = 1000;   //in ms


//################### STATE MANAGEMENT ##################################################################################################################
//states of the simulation tab
const STATE_NOTHING_LOADED = 0;     //initial state, goes to LOADED
const STATE_LOADED = 1;             //can go to SIMULATING and DIASHOW, both of them can lead to LOADED (somewhere between start and end)
const STATE_LOADED_START = 2;       //can go to SIMULATING, DIASHOW, LOADED or LOADED_END
const STATE_LOADED_END = 3;         //can go to LOADED or LOADED_START
const STATE_SIMULATING = 4;         //can go to LOADED
const STATE_DIASHOW = 5;            //can go to LOADED
const STATE_LOADED_EMPTY = 6;       //can't navigate

let runDia = false;
let simState = STATE_NOTHING_LOADED;

/**Changes the state of the simulation-UI by properly enabling disabling certain UI elements.
 *
 * @param state the state we want to switch to
 */
function changeState(state) {
    let enable;
    let disable;
    switch (state) {
        case STATE_NOTHING_LOADED:      //no navigation
            enable = [  "sim_tab", "ver_tab",
                        "sim_drop_zone", "sim_q_algo",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"
            ];
            disable = [ "toStart", "prev", "automatic", "next", "toEnd", "toLine" ];
            break;

        case STATE_LOADED:
            enable = [  "sim_tab", "ver_tab",
                        "sim_drop_zone", "sim_q_algo",
                        "toStart", "prev", "automatic", "next", "toEnd", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"
            ];
            disable = [  ];
            break;

        case STATE_LOADED_START:
            enable = [  "sim_tab", "ver_tab",
                        "sim_drop_zone", "sim_q_algo",
                        "automatic", "next", "toEnd", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"
            ];
            disable = [ "toStart", "prev" ];
            break;

        case STATE_LOADED_END:
            enable = [  "sim_tab", "ver_tab",
                        "sim_drop_zone", "sim_q_algo",
                        "toStart", "prev", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"
            ];
            disable = [ "toEnd", "next", "automatic" ];   //don't disable q_algo because the user might want to add lines to the end
            break;

        case STATE_SIMULATING:
            enable =  [];
            disable = [ "sim_tab", "ver_tab",
                        "toStart", "prev", "automatic", "next", "toEnd", "toLine",      //navigation buttons
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",                   //example algorithms
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"    //advanced settings
            ];
            //in firefox my onScroll-event is ignored if sim_q_algo is disabled, so for firefox things must be handled differently and enable it
            if(isFirefox) {
                enable.push("sim_drop_zone");
                enable.push("sim_q_algo");
            } else {
                disable.push("sim_drop_zone");
                disable.push("sim_q_algo");
            }
            break;

        case STATE_DIASHOW:
            runDia = true;
            automatic.text("||");   //\u23F8
            enable = [ "automatic" ];
            disable = [ "sim_tab", "ver_tab",
                        "toStart", "prev", "next", "toEnd", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"
            ];
            //in firefox my onScroll-event is ignored if sim_q_algo is disabled, so for firefox things must be handled differently and enable it
            if(isFirefox) {
                enable.push("sim_drop_zone");
                enable.push("sim_q_algo");
            } else {
                disable.push("sim_drop_zone");
                disable.push("sim_q_algo");
            }

            break;

        case STATE_LOADED_EMPTY:    //no navigation allowed (we are at the beginning AND at the end)
            enable = [  "sim_tab", "ver_tab",
                        "sim_drop_zone", "sim_q_algo",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu",
                        "stepDuration", "cb_colored", "cb_edge_labels", "cb_classic"
            ];
            disable = [ "toStart", "prev", "automatic", "next", "toEnd", "toLine" ];
            break;
    }

    _enableElementsWithID(enable);
    _disableElementsWithID(disable);

    simState = state;
}

/**Enables all elements whose id is mentioned in the parameter.
 *
 * @param ids string-array with the ids of all elements that should be enabled
 * @private
 */
function _enableElementsWithID(ids) {
    ids.forEach((id) => {
        const elem = document.getElementById(id);
        elem.disabled = false;
    });
}

/**Disables all elements whose id is mentioned in the parameter.
 *
 * @param ids string-array with the ids of all elements that should be disabled
 * @private
 */
function _disableElementsWithID(ids) {
    ids.forEach((id) => {
        const elem = document.getElementById(id);
        elem.disabled = true;
    });
}

//################### UI INITIALIZATION ##################################################################################################################
//accordion
//from https://www.w3schools.com/howto/howto_js_accordion.asp
const acc = document.getElementsByClassName("accordion");
for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", () => {
        /* Toggle between adding and removing the "active" class,
        to highlight the button that controls the panel */
        acc[i].classList.toggle("active");

        /* Toggle between hiding and showing the active panel */
        const panel = acc[i].nextElementSibling;
        if (panel.style.display === "block") panel.style.display = "none";
        else panel.style.display = "block";
    });
}


const algoArea = new AlgoArea(algo_div, "sim", changeState, print, showError);
registerAlgoArea("sim", algoArea);  //register at main for resizing

//append the navigation div below algoArea
algo_div.append(
  '<div id="nav_div">\n' +
    '        <button type="button" id="toStart" class="nav-button" onclick="sim_gotoStart()" ' +
    'title="Go back to the initial state"' +
    '        >&#8606</button>\n' +
    '        <button type="button" id="prev" class="nav-button" onclick="sim_goBack()" ' +
    'title="Go to the previous operation"' +
    '        >&#8592</button>\n' +
    '        <button type="button" id="automatic" class="nav-button" onclick="sim_diashow()" ' +
    'title="Start a diashow"' +
    '        >&#9654</button>\n' +
    '        <button type="button" id="next" class="nav-button" onclick="sim_goForward()"' +
    'title="Apply the current operation"' +
    '        >&#8594</button>\n' +
    '        <button type="button" id="toEnd" class="nav-button" onclick="sim_gotoEnd()"' +
    'title="Apply all remaining operations"' +
    '        >&#8608</button>\n' +
    '        <p></p>\n' +
    '        <button type="button" id="toLine" onclick="sim_gotoLine()">Go to line</button>\n' +
    '        <input type="number" id="line_to_go" min="0" value="0" onchange="validateLineNumber()"/>\n' +
    '</div>'
);
const line_to_go = $('#line_to_go');    //must be created here since it doesn't exist before
const automatic = $('#automatic');

//if enter is pressed inside line_to_go, we go to the stated line
line_to_go.keyup((event) => {
    if(line_to_go.is(":focus") && event.key === "Enter") {
        sim_gotoLine();
    }
});

changeState(STATE_NOTHING_LOADED);      //prepare initial state


//################### ALGORITHM LOADING ##################################################################################################################

const emptyQasm =   "OPENQASM 2.0;\n" +
                    "include \"qelib1.inc\";\n" +
                    "\n" +
                    "qreg q[];\n" +
                    "creg c[];\n";
const emptyReal =   ".version 2.0 \n" +
                    ".numvars 0 \n" +
                    ".variables \n" +
                    ".begin \n" +
                    "\n" +
                    ".end \n";

/**Load empty QASM-Format
 *
 */
function loadQASM() {
    algoArea.resetAlgorithm();

    algoArea.algoFormat = QASM_FORMAT;
    algoArea.algo = emptyQasm;
}

/**Load empty Real-Format
 *
 */
function loadReal() {
    algoArea.resetAlgorithm();
    algoArea.algoFormat = REAL_FORMAT;
    algoArea.algo = emptyReal;
}

/**Load Deutsch-algorithm
 *
 */
function loadDeutsch() {
    algoArea.emptyAlgo = false;
    algoArea.algoChanged = true;

    algoArea.algoFormat = QASM_FORMAT;
    algoArea.algo = "OPENQASM 2.0;\n" +
                    "include \"qelib1.inc\";\n" +
                    "\n" +
                    "qreg q[2];\n" +
                    "creg c[2];\n" +
                    "\n" +
                    "x q[1];\n" +
                    "h q[0];\n" +
                    "h q[1];\n" +
                    "cx q[0],q[1];\n" +
                    "h q[0];\n";

    algoArea.loadAlgorithm(QASM_FORMAT, true);   //new algorithm -> new simulation
}

/**Load Alu-algorithm
 *
 */
function loadAlu() {
    algoArea.emptyAlgo = false;
    algoArea.algoChanged = true;

    algoArea.algoFormat = QASM_FORMAT;
    algoArea.algo =
        "OPENQASM 2.0;\n" +
        "include \"qelib1.inc\";\n" +
        "qreg q[5];\n" +
        "creg c[5];\n" +
        "cx q[2],q[1];\n" +
        "cx q[2],q[0];\n" +
        "h q[2];\n" +
        "t q[3];\n" +
        "t q[0];\n" +
        "t q[2];\n" +
        "cx q[0],q[3];\n" +
        "cx q[2],q[0];\n" +
        "cx q[3],q[2];\n" +
        "tdg q[0];\n" +
        "cx q[3],q[0];\n" +
        "tdg q[3];\n" +
        "tdg q[0];\n" +
        "t q[2];\n" +
        "cx q[2],q[0];\n" +
        "cx q[3],q[2];\n" +
        "cx q[0],q[3];\n" +
        "h q[2];\n" +
        "h q[0];\n" +
        "t q[1];\n" +
        "t q[4];\n" +
        "t q[0];\n" +
        "cx q[4],q[1];\n" +
        "cx q[0],q[4];\n" +
        "cx q[1],q[0];\n" +
        "tdg q[4];\n" +
        "cx q[1],q[4];\n" +
        "tdg q[1];\n" +
        "tdg q[4];\n" +
        "t q[0];\n" +
        "cx q[0],q[4];\n" +
        "cx q[1],q[0];\n" +
        "cx q[4],q[1];\n" +
        "h q[0];\n" +
        "h q[2];\n" +
        "t q[3];\n" +
        "t q[0];\n" +
        "t q[2];\n" +
        "cx q[0],q[3];\n" +
        "cx q[2],q[0];\n" +
        "cx q[3],q[2];\n" +
        "tdg q[0];\n" +
        "cx q[3],q[0];\n" +
        "tdg q[3];\n" +
        "tdg q[0];\n" +
        "t q[2];\n" +
        "cx q[2],q[0];\n" +
        "cx q[3],q[2];\n" +
        "cx q[0],q[3];\n" +
        "h q[2];\n" +
        "h q[0];\n" +
        "t q[1];\n" +
        "t q[4];\n" +
        "t q[0];\n" +
        "cx q[4],q[1];\n" +
        "cx q[0],q[4];\n" +
        "cx q[1],q[0];\n" +
        "tdg q[4];\n" +
        "cx q[1],q[4];\n" +
        "tdg q[1];\n" +
        "tdg q[4];\n" +
        "t q[0];\n" +
        "cx q[0],q[4];\n" +
        "cx q[1],q[0];\n" +
        "cx q[4],q[1];\n" +
        "h q[0];\n" +
        "cx q[4],q[3];\n" +
        "h q[2];\n" +
        "t q[0];\n" +
        "t q[3];\n" +
        "t q[2];\n" +
        "cx q[3],q[0];\n" +
        "cx q[2],q[3];\n" +
        "cx q[0],q[2];\n" +
        "tdg q[3];\n" +
        "cx q[0],q[3];\n" +
        "tdg q[0];\n" +
        "tdg q[3];\n" +
        "t q[2];\n" +
        "cx q[2],q[3];\n" +
        "cx q[0],q[2];\n" +
        "cx q[3],q[0];\n" +
        "h q[2];\n" +
        "x q[2];\n"
    ;

    algoArea.loadAlgorithm(QASM_FORMAT, true);   //new algorithm -> new simulation
}

//################### NAVIGATION ##################################################################################################################
/**Sets the simulation back to its initial state by calling /tostart and updates the DD if necessary.
 *
 */
function sim_gotoStart() {
    changeState(STATE_SIMULATING);
    startLoadingAnimation();

    const call = $.ajax({
        url: '/tostart?dataKey=' + dataKey,
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                algoArea.hlManager.initialHighlighting();
            }
            endLoadingAnimation();
            changeState(STATE_LOADED_START);
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going back to the start failed!");
        _generalStateChange();
    });
}

/**Goes one step back in the simulation by calling /prev and updates the DD if necessary.
 *
 */
function sim_goBack() {
    changeState(STATE_SIMULATING);
    startLoadingAnimation();

    const call = $.ajax({
        url: '/prev?dataKey=' + dataKey,
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                algoArea.hlManager.decreaseHighlighting();

                endLoadingAnimation();
                if(algoArea.hlManager.highlightedLines <= 0) changeState(STATE_LOADED_START);
                else changeState(STATE_LOADED);

            } else {
                endLoadingAnimation();
                changeState(STATE_LOADED_START);
            } //should never reach this code because the button should be disabled when we reach the start
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going a step back failed!");
        _generalStateChange();
    });
}

/**Either starts or stops the diashow. While a diashow is running the client periodically (defined by stepDuration) calls
 * /next and updates the DD until the end of the algorithm is reached or the diashow is stopped manually.
 *
 */
function sim_diashow() {
    /**Convenience function to avoid code duplication. Simply sets everything that is needed to properly stop the diashow.
     *
     */
    function endDia() {
        runDia = false;
        _generalStateChange();  //in error-cases we also call endDia(), and in normal cases it doesn't matter that we call this function
        automatic.text("\u25B6");   //play-symbol in unicode
    }

    if(runDia) endDia();
    else {
        runDia = true;
        changeState(STATE_DIASHOW);

        /**Periodically calls /next and updates DD if necessary
         *
         */
        const func = () => {
            if(runDia) {
                const startTime = performance.now();
                const call = $.ajax({
                    url: '/next?dataKey=' + dataKey,
                    contentType: 'application/json',
                    success: (res) => {

                        if(res.dot) {
                            print(res.dot);

                            algoArea.hlManager.increaseHighlighting();

                            const duration = performance.now() - startTime;     //calculate the duration of the API-call so the time between two steps is constant
                            setTimeout(() => func(), stepDuration - duration); //wait a bit so the current qdd can be shown to the user

                        } else endDia();
                    }
                });
                call.fail((res) => {
                    if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

                    if(res.responseJSON && res.responseJSON.msg) showError(res.responseJSON.msg + "\nAborting diashow.");
                    else if(altMsg) showError("Going a step ahead failed! Aborting diashow.");
                    endDia();
                });
            }
        };
        setTimeout(() => func(), stepDuration);
    }
}

/**Goes one step forward in the simulation by calling /next and updates the DD if necessary.
 *
 */
function sim_goForward() {
    changeState(STATE_SIMULATING);
    startLoadingAnimation();

    const call = $.ajax({
        url: '/next?dataKey=' + dataKey,
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {   //we haven't reached the end yet
                print(res.dot);

                algoArea.hlManager.increaseHighlighting();

                endLoadingAnimation();
                if(algoArea.hlManager.highlightedLines >= algoArea.numOfOperations) changeState(STATE_LOADED_END);
                else changeState(STATE_LOADED);

            } else {
                endLoadingAnimation();
                changeState(STATE_LOADED_END); //should never reach this code because the button should be disabled when we reach the end
            }
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going a step ahead failed!");
        _generalStateChange();
    });
}

/**Simulates to the end of the algorithm by calling /toend and updates the DD if necessary.
 *
 */
function sim_gotoEnd() {
    changeState(STATE_SIMULATING);
    startLoadingAnimation();

    const call = $.ajax({
        url: '/toend?dataKey=' + dataKey,
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                algoArea.hlManager.highlightEverything();
            }
            endLoadingAnimation();
            changeState(STATE_LOADED_END);
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going to the end failed!");
        _generalStateChange();
    });
}

/**Simulates to the given line by calling /toline and updates the DD if necessary.
 *
 */
function sim_gotoLine() {
    changeState(STATE_SIMULATING);
    startLoadingAnimation();

    //the user is not allowed to go to a line that is not in the algorithm
    let line = parseInt(line_to_go.val());
    if(line > algoArea.numOfOperations) {
        line = algoArea.numOfOperations;
        line_to_go.val(line);
    }
    const call = $.ajax({
        url: '/toline?line=' + line + '&dataKey=' + dataKey,
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                algoArea.hlManager.highlightToXOps(line);
            }
            _generalStateChange();  //even though no error occurred, it is still possible for every LOADED-state to be the correct one
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going to line " + line + " failed!");
        _generalStateChange();
    });
}

/**If we don't know which states are possible (for example on error), we call this function since it covers all possible
 * states after a simulation step.
 *
 * @private
 */
function _generalStateChange() {
    endLoadingAnimation();

    //determine our current position in the algorithm
    if(algoArea.hlManager.highlightedLines <= 0) changeState(STATE_LOADED_START);
    else if(algoArea.hlManager.highlightedLines >= algoArea.numOfOperations) changeState(STATE_LOADED_END);
    else changeState(STATE_LOADED);
}

/**Checks if the number the user entered in line_to_go is an integer between 0 and numOfOperations. If this is not the
 * case an error is shown and the value is reset.
 *
 */
function validateLineNumber() {
    const lineNum = line_to_go.val();
    if(lineNum.includes(".")) {
        showError("Floats are not allowed! Only unsigned integers are valid.\n" +
            "Possible values: [0, " + algoArea.numOfOperations + "]");
        line_to_go.val(0);
    } else {
        const num = parseInt(lineNum);
        if(num || num === 0) {
            if(num < 0) {
                showError("You can't go to a negative line number!\nPossible values: [0, " + algoArea.numOfOperations + "]");
                line_to_go.val(0);
            } else if(num > algoArea.numOfOperations) {
                showError("Line #" + num + " doesn't exist!\nPossible values: [0, " + algoArea.numOfOperations + "]");
                line_to_go.val(algoArea.numOfOperations);
            }
        } else {
            showError("Your input is not a number!\n" +
                "Please enter an unsigned integer of the interval [0, " + algoArea.numOfOperations + "].");
            line_to_go.val(0);
        }
    }
}

//################### ERROR HANDLING ##################################################################################################################
//moved to main.js

//$( document ).ajaxError(function( event, request, settings ) {
//    showError( "Unhandled error occured! Error requesting page " + settings.url);
//});



//################### MISC ##################################################################################################################

let svgHeight = 0;  //can't be initialized beforehand
/**Visualizes the given DD as d3 graph with a transition animation.
 *
 * @param dot a string representing a DD in the .dot-format
 *          if not given, the graph will be reset (no DD visualized)
 */
function print(dot) {
    if(dot) {
        //document.getElementById('color_map').style.display = 'block';
        if(svgHeight === 0) {
            //subtract the whole height of the qdd-text from the height of qdd-div to get the space that is available for the graph
            svgHeight = parseInt(qdd_div.css('height')) - (
                parseInt(qdd_text.css('height')) + parseInt(qdd_text.css('margin-top')) + parseInt(qdd_text.css('margin-bottom'))    //height of the qdd-text
            );
        }

        let animationDuration = 500;
        if(stepDuration < 1000) animationDuration = stepDuration / 2;

        const graph = d3.select("#qdd_div").graphviz({
            width: "70%",     //make it smaller so we have space around where we can scroll through the page - also the graphs are more high than wide so is shouldn't be a problem
            height: svgHeight,
            fit: true           //automatically zooms to fill the height (or width, but usually the graphs more high then wide)
        }).tweenPaths(true).tweenShapes(true).transition(() => d3.transition().ease(d3.easeLinear).duration(animationDuration)).renderDot(dot);

        //$('#color_map').html(
        //    '<svg><rect width="20" height="20" fill="purple"></rect></svg>'
        //);

    } else {
        qdd_div.html(qdd_text);
        //document.getElementById('color_map').style.display = 'none';
    }
}

/**Checks if the number the user entered in step_duration is an integer > 0. If this is not the
 * case an error is shown and the value is reset to the previous value.
 *
 */
function validateStepDuration() {
    const input = step_duration.val();
    if(input.includes(".") || input.includes(",")) {
        showError("Floats are not allowed!\nPlease enter an unsigned integer instead.");
        step_duration.val(stepDuration);
    } else {
        const newVal = parseInt(input);
        if(0 <= newVal) {
            stepDuration = newVal;
            step_duration.val(newVal);  //needs to be done because of parseInt possible Floats are cut off

        } else {
            showError("Invalid number for step-duration: Only unsigned integers allowed!");
            step_duration.val(stepDuration);
        }
    }
}

/**Updates the export options that define some visual properties of the DD by calling /updateExportOptions and udpating
 * the DD if necessary.
 *
 */
function updateExportOptions() {
    const colored = cb_colored.prop('checked');
    const edgeLabels = cb_edge_labels.prop('checked');
    const classic = cb_classic.prop('checked');

    const lastState = simState;
    changeState(STATE_SIMULATING);
    startLoadingAnimation();

    const call = jQuery.ajax({
        type: 'PUT',
        url: '/updateExportOptions',
        data: { colored: colored, edgeLabels: edgeLabels, classic: classic, updateDD: !algoArea.emptyAlgo, dataKey: dataKey },
        success: (res) => {
            if (res.dot) print(res.dot);
            endLoadingAnimation();
            changeState(lastState); //go back to the previous state
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        endLoadingAnimation();
        showResponseError(res, "");
        _generalStateChange();
    });
}
