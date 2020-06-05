//################### J-QUERY ELEMENTS ###############################################################################################################

const step_duration = $('#stepDuration');
const algo_div = $('#algo_div');
const drop_zone = $('#drop_zone');
const backdrop = $('#backdrop');
const line_numbers = $('#line_numbers');
const highlighting = $('#highlighting');
const q_algo = $('#q_algo');
const automatic = $('#automatic');
const line_to_go = $('#line_to_go');
const qdd_div = $('#qdd_div');
const qdd_text = $('#qdd_text');
//todo also initialize all other selectors once?


//################### CONFIGURATION ##################################################################################################################
const paddingLeftOffset = 10;   //10px is the padding of lineNumbers, so q_algo also needs at least this much padding
const paddingLeftPerDigit = 10; //padding of q_algo based on the number of digits the line-numbering needs

let stepDuration = 700;   //in ms

//################### STATE MANAGEMENT ##################################################################################################################
//states of the simulation tab
const STATE_NOTHING_LOADED = 0;     //initial state, goes to LOADED
const STATE_LOADED = 1;             //can go to SIMULATING and DIASHOW, both of them can lead to LOADED (somewhere between start and end)
const STATE_LOADED_START = 2;       //can go to SIMULATING, DIASHOW, LOADED or LOADED_END
const STATE_LOADED_END = 3;         //can go to LOADED or LOADED_START
const STATE_SIMULATING = 4;         //can go to LOADED
const STATE_DIASHOW = 5;            //can go to LOADED

let runDia = false;
let pauseDia = false;

function changeState(state) {
    let enable;
    let disable;
    switch (state) {
        case STATE_NOTHING_LOADED:
            enable = [ "drop_zone", "q_algo", "ex_real", "ex_qasm", "ex_deutsch", "ex_alu", "stepDuration" ];
            disable = [ "toStart", "prev", "automatic", "next", "toEnd", "toLine" ];
            break;

        case STATE_LOADED:
            enable = [  "drop_zone", "q_algo", "toStart", "prev", "automatic", "next", "toEnd", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu", "stepDuration" ];
            disable = [  ];
            break;

        case STATE_LOADED_START:
            enable = [  "drop_zone", "q_algo", "automatic", "next", "toEnd", "toLine", "ex_real", "ex_qasm",
                        "ex_deutsch", "ex_alu", "stepDuration" ];
            disable = [ "toStart", "prev" ];
            break;

        case STATE_LOADED_END:
            enable = [ "drop_zone", "q_algo", "toStart", "prev", "toLine", "ex_real", "ex_qasm", "ex_deutsch", "ex_alu", "stepDuration" ];
            disable = [ "toEnd", "next", "automatic" ];   //don't disable q_algo because the user might want to add lines to the end
            break;

        case STATE_SIMULATING:
            enable = [];
            disable = [ "drop_zone", "q_algo", "toStart", "prev", "automatic", "next", "toEnd", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu", "stepDuration" ];
            break;

        case STATE_DIASHOW:
            runDia = true;
            pauseDia = false;
            automatic.text("||");   //\u23F8
            enable = [ "automatic" ];
            disable = [ "drop_zone", "q_algo", "toStart", "prev", "next", "toEnd", "toLine",
                        "ex_real", "ex_qasm", "ex_deutsch", "ex_alu", "stepDuration" ];
            break;
    }

    enableElementsWithID(enable);
    disableElementsWithID(disable);
}

function enableElementsWithID(ids) {
    ids.forEach((id) => {
        const elem = document.getElementById(id);
        elem.disabled = false;
    });
}

function disableElementsWithID(ids) {
    ids.forEach((id) => {
        const elem = document.getElementById(id);
        elem.disabled = true;
    });
}

//################### UI INITIALIZATION ##################################################################################################################
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

window.addEventListener('resize', (event) => updateSizes());
function updateSizes() {
    const dzInnerWidth = parseFloat(drop_zone.css('width')) - 2 * parseFloat(drop_zone.css('border'));  //inner width of drop_zone
    const width = dzInnerWidth - parseFloat(q_algo.css('margin-left'));
    q_algo.css('width', width);

    if(dzInnerWidth > 0) {
        let lh = "<mark>";
        for(let i = 0; i < dzInnerWidth / 4; i++) lh += " ";
        lh += "</mark>";
        updateLineHighlight(lh);
    }
}


function validateStepDuration() {
    const input = step_duration.val();
    if(input.includes(".") || input.includes(",")) {
        showError("Floats are not allowed!\nPlease enter an unsigned integer instead.");
        step_duration.val(stepDuration);
    } else {
        const newVal = parseInt(input);
        if(newVal && 0 <= newVal) {
            stepDuration = newVal;
            step_duration.val(newVal);  //needs to be done because of parseInt possible Floats are cut off

        } else {
            showError("Invalid number for step-duration: Only unsigned integers allowed!");
            step_duration.val(stepDuration);
            return false;
        }
    }
}

changeState(STATE_NOTHING_LOADED);      //initial state




//################### ALGORITHM LOADING ##################################################################################################################
const FORMAT_UNKNOWN = 0;
const QASM_FORMAT = 1;
const REAL_FORMAT = 2;

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
let emptyAlgo = false;  //whether currently one of the two empty algorithms (templates) are in the textArea or not

function resetAlgorithm() {
    emptyAlgo = true;
    algoFormat = FORMAT_UNKNOWN;

    hlManager.resetHighlighting("");
    removeLineNumbers();
    q_algo.val("");
    setQAlgoMarginLeft();   //reset margin-left to the initial/default value

    print();    //reset dd

    changeState(STATE_NOTHING_LOADED);
}

/**Load empty QASM-Format
 *
 */
function loadQASM() {
    resetAlgorithm();
    q_algo.val(emptyQasm);
    algoFormat = QASM_FORMAT;
}

/**Load empty Real-Format
 *
 */
function loadReal() {
    resetAlgorithm();
    q_algo.val(emptyReal);
    algoFormat = REAL_FORMAT;
}

const deutschAlgorithm =    "OPENQASM 2.0;\n" +
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
function loadDeutsch() {
    q_algo.val(deutschAlgorithm);

    emptyAlgo = false;
    algoChanged = true;
    loadAlgorithm(QASM_FORMAT, true);   //new algorithm -> new simulation
}

function loadAlu() {
    q_algo.val(
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
    );

    emptyAlgo = false;
    algoChanged = true;
    loadAlgorithm(QASM_FORMAT, true);   //new algorithm -> new simulation
}

function dropHandler(event) {
    event.preventDefault();     //prevents the browser from opening the file and therefore leaving the website

    if(event.dataTransfer.items) {  //check if a file was transmitted/dropped
        for(let i = 0; i < event.dataTransfer.files.length; i++) {
            //determine which format to load or show an error
            let format = FORMAT_UNKNOWN;
            if(event.dataTransfer.files[i].name.endsWith(".qasm")) format = QASM_FORMAT;
            else if(event.dataTransfer.files[i].name.endsWith(".real")) format = REAL_FORMAT;
            else {
                showError("Filetype not supported!");
                return;
            }

            const file = event.dataTransfer.files[i];
            const reader = new FileReader();
            reader.onload = function(e) {
                q_algo.val(e.target.result);
                algoChanged = true;
                loadAlgorithm(format, true);    //since a completely new algorithm has been uploaded we have to throw away the old simulation data
            };
            reader.readAsBinaryString(file);
        }
    }
}

let algoFormat = FORMAT_UNKNOWN;
let numOfOperations = 0;    //number of operations the whole algorithm has
let lastValidAlgorithm = deutschAlgorithm;  //initialized with an arbitrary valid algorithm (deutsch: because it was available and it is short)
/**Loads the algorithm placed inside the textArea #q_algo
 *
 * @param format the format in which the algorithm is written; the only occasion where this parameter is not set
 *        is when leaving the textArea after editing, but in this case the format didn't change so the old algoFormat is used
 * @param reset whether a new simulation needs to be started after loading; default false because again the only occasion
 *        it is not set is after editing, but there we especially don't want to reset
 * @param algorithm only needed if the lastValidAlgorithm should be sent again because the algorithm in q_algo is invalid
 */
function loadAlgorithm(format = algoFormat, reset = false, algorithm) {
    if(emptyAlgo || !algoChanged) return;

    const startTimeStemp = performance.now();
    let algo = algorithm || q_algo.val();   //usually q_algo.val() is taken
    const opNum = reset ?
        0 : //parseInt(line_to_go.val()) :
        hlManager.highlightedLines;   //we want to continue simulating after the last processed line, which is after the highlighted ones

    if(format === FORMAT_UNKNOWN) {
        //find out of which format the input text is
        if(algo.includes("OPENQASM")) format = QASM_FORMAT;
        else format = REAL_FORMAT;      //right now only these two formats are supported, so if it is not QASM, it must be Real
    }

    if(algo) {
        algo = preformatAlgorithm(algo, format);
        const call = $.post("/load", { basisStates: null, algo: algo, opNum: opNum, format: format, reset: reset });
        call.done((res) => {
            _loadingSuccess(res, algo, opNum, format, reset);

            if(opNum === 0) changeState(STATE_LOADED_START);
            else if(opNum === numOfOperations) changeState(STATE_LOADED_END);
            else changeState(STATE_LOADED);
        });
        call.fail((res) => {
            if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

            //todo ask if this really is necessary or has any benefit, because disabling the buttons seems far more intuitive and cleaner
            if(res.responseJSON && res.responseJSON.retry && !algorithm) {
                const call2 = $.post("/load", { basisStates: null, algo: lastValidAlgorithm, opNum: opNum, format: format, reset: reset });
                call2.done((res2) => {
                    _loadingSuccess(res2, lastValidAlgorithm, opNum, format, reset);

                    q_algo.prop('selectionStart', lastCursorPos);
                    q_algo.prop('selectionEnd', lastCursorPos+1);

                    //set the focus and scroll to the cursor positoin - doesn't work on Opera
                    q_algo.blur();
                    q_algo.focus();
                    $.trigger({ type: 'keypress' });
                });
                // call2.fail((res2) => {
                //    showResponseError(res, )
                // });
            }
            changeState(STATE_NOTHING_LOADED);
            showResponseError(res, "Couldn't connect to the server.");

        });
        console.log("Loading and processing " + opNum + " lines took " + (performance.now() - startTimeStemp) + "ms");
    }
}

function _loadingSuccess(res, algo, opNum, format, reset) {
    algoFormat = format;
    oldAlgo = algo;
    algoChanged = false;
    lastValidAlgorithm = algo;  //algorithm in q_algo was valid if no error occured

    if(reset) {
        hlManager.resetHighlighting(q_algo.val());
        hlManager.highlightedLines = opNum;
        hlManager.setHighlights();
    } else hlManager.text = q_algo.val();

    numOfOperations = Math.max(res.data, 1);  //number of operations the algorithm has; at least the initial padding of 1 digit
    const digits = _numOfDigits(numOfOperations);
    setQAlgoMarginLeft(digits);

    setLineNumbers();

    print(res.dot);

    //if the user-chosen number is too big, we go as far as possible and enter the correct value in the textField
    if(opNum > numOfOperations) line_to_go.val(numOfOperations);
}

function setQAlgoMarginLeft(digits = 1) {
    const margin = paddingLeftOffset + paddingLeftPerDigit * digits;
    q_algo.css('margin-left', margin); //need to set margin because padding is ignored when scrolling

    const width = parseInt(drop_zone.css('width')) - margin - 2 * parseInt(drop_zone.css('border'));
    q_algo.css('width', width);
}

function preformatAlgorithm(algo, format) {
    let setQAlgo = false;

    //make sure every operation is in a separate line
    if(format === QASM_FORMAT) {
        let temp = "";
        const lines = algo.split('\n');
        for(let i = 0; i < lines.length; i++) {
            const line = lines[i];
            //"\n" needs to be added separately because it was removed while splitting
            if(isOperation(line, format)) {
                let l = line;
                while(l.length !== 0) {
                    const i = l.indexOf(';');
                    if(i === -1) {  //no semicolon found -> we insert it (though this might lead to an error if the ;
                                    // is at the start of a following line. but checking this would be complicated,
                                    // because there could be arbitrary many empty lines or comments or other operations
                                    // in between)
                        temp += l + ";\n";  //insert the missing semicolon and the newline, then stop continue with the next line
                        break;
                    }

                    const op =  l.substring(0, i+1);    //we need to include the semicolon, so it is i+1
                    l = l.substring(i+1);

                    //special case for comments in the same line as an operation
                    if(isComment(l, format)) {
                        temp += op + l + "\n";  //the comment is allowed to stay in the same line
                        break;
                    } else temp += op + "\n";    //insert the operation with the added newLine
                    l = l.trim();
                }
            } else {
                temp += line;
                //don't create a new line for the last line, because the way splitting works there was no \n at the end of the last line
                if(i < lines.length-1) temp += "\n";
            }
        }
        algo = temp;
        setQAlgo = true;
    }
    //for REAL_FORMAT this is inherently the case, because \n is used to separate operations

    //append an empty line at the end if there is none yet
    if(!algo.endsWith("\n")) {
        algo = algo + "\n";
        setQAlgo = true;
    }


    if(setQAlgo) q_algo.val(algo);
    return algo;
}

//################### NAVIGATION ##################################################################################################################
$(() =>  {
    automatic.on('click', () => {
        function endDia() {
            pauseDia = true;
            runDia = false;

            if(hlManager.highlightedLines >= numOfOperations) changeState(STATE_LOADED_END);
            else changeState(STATE_LOADED);
            automatic.text("\u25B6");   //play-symbol in unicode
        }

        if(runDia) {
            endDia();

        } else {
            runDia = true;
            changeState(STATE_DIASHOW);

            const func = () => {
                if(!pauseDia) {
                    const startTime = performance.now();
                    const call = $.ajax({
                        url: '/next',
                        contentType: 'application/json',
                        success: (res) => {

                            if(res.dot) {
                                print(res.dot);

                                hlManager.increaseHighlighting();

                                const duration = performance.now() - startTime;     //calculate the duration of the API-call so the time between two steps is constant
                                setTimeout(() => func(), stepDuration - duration); //wait a bit so the current qdd can be shown to the user

                            } else endDia();
                        }
                    });
                    call.fail((res) => {
                        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

                        showResponseError(res, "Going a step ahead failed! Aborting Diashow."); //todo notify user that the diashow was aborted if res-msg is shown?
                        endDia();
                    });
                }
            };
            setTimeout(() => func(), stepDuration);
        }
    });
});

function gotoStart() {
    changeState(STATE_SIMULATING);
    const call = $.ajax({
        url: '/tostart',
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                hlManager.initialHighlighting();
            }
            changeState(STATE_LOADED_START);
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going back to the start failed!");
        //determine our current position in the algorithm
        if(hlManager.highlightedLines === 0) changeState(STATE_LOADED_START);
        else if(hlManager.highlightedLines === numOfOperations) changeState(STATE_LOADED_END);
        else changeState(STATE_LOADED);
    });
}

function goBack() {
    changeState(STATE_SIMULATING);
    const call = $.ajax({
        url: '/prev',
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);

                hlManager.decreaseHighlighting();
                if(hlManager.highlightedLines <= 0) changeState(STATE_LOADED_START);
                else changeState(STATE_LOADED);

            } else changeState(STATE_LOADED_START); //should never reach this code because the button should be disabled when we reach the start
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going a step back failed!");
        //determine our current position in the algorithm
        if(hlManager.highlightedLines === 0) changeState(STATE_LOADED_START);
        else if(hlManager.highlightedLines === numOfOperations) changeState(STATE_LOADED_END);
        else changeState(STATE_LOADED);
    });
}

function goForward() {
    const startTimeStemp = performance.now();
    changeState(STATE_SIMULATING);
    const call = $.ajax({
        url: '/next',
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {   //we haven't reached the end yet
                print(res.dot);

                hlManager.increaseHighlighting();

                if(hlManager.highlightedLines >= numOfOperations) changeState(STATE_LOADED_END);
                else changeState(STATE_LOADED);

            } else changeState(STATE_LOADED_END); //should never reach this code because the button should be disabled when we reach the end

            console.log("Time spent: " + (performance.now() - startTimeStemp) + "ms");
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going a step ahead failed!");
        //determine our current position in the algorithm
        if(hlManager.highlightedLines === 0) changeState(STATE_LOADED_START);
        else if(hlManager.highlightedLines === numOfOperations) changeState(STATE_LOADED_END);
        else changeState(STATE_LOADED);
    });
}

function gotoEnd() {
    changeState(STATE_SIMULATING);
    const call = $.ajax({
        url: '/toend',
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                hlManager.highlightEverything();
            }
            changeState(STATE_LOADED_END);
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going to the end failed!");
        //determine our current position in the algorithm
        if(hlManager.highlightedLines === 0) changeState(STATE_LOADED_START);
        else if(hlManager.highlightedLines === numOfOperations) changeState(STATE_LOADED_END);
        else changeState(STATE_LOADED);
    });
}

function gotoLine() {
    changeState(STATE_SIMULATING);
    const line = Math.min(parseInt(line_to_go.val()), numOfOperations);
    const call = $.ajax({
        url: '/toline?line=' + line,
        contentType: 'application/json',
        success: (res) => {
            if(res.dot) {
                print(res.dot);
                hlManager.highlightToXOps(line);
            }
            //determine our current position in the algorithm
            if(hlManager.highlightedLines === 0) changeState(STATE_LOADED_START);
            else if(hlManager.highlightedLines === numOfOperations) changeState(STATE_LOADED_END);
            else changeState(STATE_LOADED);
        }
    });
    call.fail((res) => {
        if(res.status === 404) window.location.reload(false);   //404 means that we are no longer registered and therefore need to reload

        showResponseError(res, "Going to line " + line + " failed!");
        //determine our current position in the algorithm
        if(hlManager.highlightedLines === 0) changeState(STATE_LOADED_START);
        else if(hlManager.highlightedLines === numOfOperations) changeState(STATE_LOADED_END);
        else changeState(STATE_LOADED);
    });
}

function validateLineNumber() {
    const lineNum = line_to_go.val();
    if(lineNum.includes(".")) {
        showError("Floats are not allowed! Only unsigned integers are valid.\n" +
            "Possible values: [0, " + numOfOperations + "]");
        line_to_go.val(0);
    } else {
        const num = parseInt(lineNum);
        if(num || num === 0) {
            if(num < 0) {
                showError("You can't go to a negative line number!\nPossible values: [0, " + numOfOperations + "]");
                line_to_go.val(0);
            } else if(num > numOfOperations) {
                showError("Line #" + num + " doesn't exist!\nPossible values: [0, " + numOfOperations + "]");
                line_to_go.val(numOfOperations);
            }
        } else {
            showError("Your input is not a number!\n" +
                "Please enter an unsigned integer of the interval [0, " + numOfOperations + "].");
            line_to_go.val(0);
        }
    }
}

//################### LINE HIGHLIGHTING ##################################################################################################################
const hlManager = new HighlightManager(highlighting, isOperation);

/**Checks if the given QASM- or Real-line is an operation
 *
 * @param line of an algorithm
 * @param format of the line we check
 */
function isOperation(line, format = algoFormat) {
    if(line) {
        if(format === QASM_FORMAT) {
            if( line.trim() === "" ||
                line.includes("OPENQASM") ||
                line.includes("include") ||
                line.includes("reg") ||
                isComment(line, format)
            ) return false;
            return true;

        } else if(format === REAL_FORMAT) {
            if( line.startsWith(".") ||   //all non-operation lines start with "."
                isComment(line, format)
            ) return false;
            return true;

        } else {
            //showError("Format not recognized. Please try again.");  //todo change message?
            console.log("Format not recognized");
            return false;
        }
    } else return false;
}

function isComment(line, format) {
    if(format === QASM_FORMAT) return line.trimStart().startsWith("//");
    else if(format === REAL_FORMAT) return line.trimStart().startsWith("#");
    else {
        console.log("Format not recognized");
        return true;
    }
}

function bindEvents() {
    q_algo.on({
        'input': handleInput,
        'scroll': handleScroll
    });
}
bindEvents();

//################### LINE NUMBERING ##################################################################################################################
/*
Only works for integers!
 */
function _numOfDigits(num) {
    return String(num).length;
}

function setLineNumbers() {
    const digits = _numOfDigits(numOfOperations);

    const lines = q_algo.val().split('\n');
    let num = 0;
    for(let i = 0; i < lines.length; i++) {
        if(i <= hlManager.offset) lines[i] = "";
        else {
            if(isOperation(lines[i])) {
                num++;
                const numDigits = _numOfDigits(num);

                let space = "";
                for(let j = 0; j < digits - numDigits; j++) space += "  ";
                lines[i] = space + num.toString();

            } else lines[i] = "";
        }
    }

    let text = "";
    lines.forEach(l => text += l + "\n");
    line_numbers.html(text);
}

function removeLineNumbers() {
    line_numbers.html("");
}


//################### HIGHLIGHTING and NUMBERING ##################################################################################################################

//highlighting and line numbering              ONLY WORKS IF EACH LINE CONTAINS NO MORE THAN 1 OPERATION!!!
//adapted from: https://codepen.io/lonekorean/pen/gaLEMR
function handleScroll() {
    const scrollTop = q_algo.scrollTop();

    backdrop.scrollTop(scrollTop);
    line_numbers.scrollTop(scrollTop);
}

let oldAlgo;   //needed to reset input if an illegal change was made
let algoChanged = false;
let lastCursorPos = 0;
function handleInput() {
    lastCursorPos = q_algo.prop('selectionStart');

    const newAlgo = q_algo.val();
    if(newAlgo.trim().length === 0) {   //user deleted everything, so we reset
        resetAlgorithm();
        return;
    }

    emptyAlgo = false;
    algoChanged = true;
    if(hlManager.highlightedLines > 0) {  //if nothing is highlighted yet, the user may also edit the lines before the first operation
        //check if a highlighted line changed, if yes abort the changes
        const curLines = newAlgo.split('\n');
        const lastLineWithHighlighting = hlManager.highlightedLines + hlManager.nopsInHighlighting;

        /*
        if(curLines.length < lastLineWithHighlighting) { //illegal change because at least the last line has been deleted
            q_algo.val(oldAlgo);   //reset algorithm to old input
            showError("You are not allowed to change already processed lines!");
            return;
        }
        */

        const oldLines = oldAlgo.split('\n');
        /*
        //header can be adapted, but lines can't be deleted (this would make a complete update of the highlighting necessary)
        for(let i = hlManager.offset; i <= lastLineWithHighlighting; i++) {
            //non-highlighted lines may change, because they are no operations
            if(hlManager.isHighlighted(i) && curLines[i] !== oldLines[i]) {   //illegal change!
                q_algo.val(oldAlgo);   //reset algorithm to old input
                showError("You are not allowed to change already processed lines!");
                return;
            }
        }
         */
        //the header is not allowed to change as well as all processed lines
        for(let i = 0; i <= lastLineWithHighlighting; i++) {
            //non-highlighted lines may change, because they are no operations
            if((i < hlManager.offset || hlManager.isHighlighted(i)) //highlighted lines and the header are not allowed to change (but comments are)
                && curLines[i] !== oldLines[i]) {   //illegal change!
                q_algo.val(oldAlgo);   //reset algorithm to old input
                showError("You are not allowed to change already processed lines!");
                selectLineWithCursor();
                return;
            }
        }
    }

    oldAlgo = q_algo.val();  //changes are legal so they are "saved"
    setLineNumbers();
}

function selectLineWithCursor() {
    const algo = q_algo.val();
    let lineStart = algo.lastIndexOf("\n", lastCursorPos) + 1;  //+1 because we need the index of the first character in the line
    let lineEnd;
    //special case where lastCursorPos is directly at the end of a line
    if(lineStart === lastCursorPos) {
        lineStart = algo.lastIndexOf("\n", lastCursorPos-2) + 1;    //lastCursorPos-1 would be the current lineStart, but we need one character before that
        lineEnd = lastCursorPos-1;  //the position right before \n

    } else lineEnd = algo.indexOf("\n", lineStart);

    q_algo.prop('selectionStart', lineStart);
    q_algo.prop('selectionEnd', lineEnd);
}



//################### ERROR HANDLING ##################################################################################################################
function showResponseError(res, altMsg = "Unknown Error!") {
    if(res.responseJSON && res.responseJSON.msg) showError(res.responseJSON.msg);
    else showError(altMsg);
}

function showError(error) {
    alert(error);
}

//$( document ).ajaxError(function( event, request, settings ) {
//    showError( "Unhandled error occured! Error requesting page " + settings.url);
//});



//################### MISC ##################################################################################################################

let svgHeight = 0;  //can't be initialized beforehand
function print(dot) {
    if(dot) {
        if(svgHeight === 0) {
            //subtract the whole height of the qdd-text from the height of qdd-div to get the space that is available for the graph
            svgHeight = parseInt($('#qdd_div').css('height')) - (
                parseInt(parseInt(qdd_text.css('height'))) + parseInt(qdd_text.css('margin-top')) + parseInt(qdd_text.css('margin-bottom'))    //height of the qdd-text
            );
        }

        const graph = d3.select("#qdd_div").graphviz({
            width: "70%",     //make it smaller so we have space around where we can scroll through the page - also the graphs are more high than wide so is shouldn't be a problem
            height: svgHeight,
            fit: true           //automatically zooms to fill the height (or width, but usually the graphs more high then wide)
        }).renderDot(dot);

    } else {
        qdd_div.html(qdd_text);
    }
}