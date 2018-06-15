// Javascript for Pharmacokinetics/Flow Rate simulator
// Created by William Kwok
'use strict';

//let canvas = $('#canvas');

// FlowNode class constructor
// FlowNode is the theoretical pipe that connects two containers together. 
// It is defined by the output end, and modified by the container that inputs into it.
// @param percentOutRate: Percentage of max output rate of container (value must be a 
//                        double between 0 and 1)
// @param inputFromContainer: String name of container inputting to current node
// @param outputToContainer: String name of container current node is outputting to
let FlowNode = function (percentOutRate, inputFromContainer, outputToContainer) {
    this.percentOutRate = percentOutRate;
    this.currRate = 0;
    this.currConcentration = 0;
    this.inputFromContainer = inputFromContainer
    this.outputToContainer = outputToContainer;
    nodeList.push(this);
}

// Container class constructur
// Container is the container that is full of the liquid that we want to keep track of
// @param maxOutRate: Maximum possible output rate as a double
// @param currLiquidLevel: Current liquid level as a double
// @param maxLiquidLevel: Maximum possible liquid level (can never overflow, for the 
//                        sake of this prototype)
// @param nameIdentifier: Name of container used for identification by Flow Nodes
// @param concentration: Initial concentration of container
// @param lethalConcentration: Concentration where the maximum color is allowed.
let Container = function (maxOutRate,
    currLiquidLevel,
    maxLiquidLevel,
    nameIdentifier,
    xPos,
    yPos,
    concentration,
    lethalConcentration) {
    this.nameIdentifier = nameIdentifier;
    this.inNodes = getMatchingInNodeArray(this.nameIdentifier);
    this.outNodes = getMatchingOutNodeArray(this.nameIdentifier);
    this.maxInRate = this.inNodes.reduce((acc, nodeIn) => getNodeRate(acc, nodeIn), 0);
    this.currInRate = this.maxInRate;
    this.currOutRate = maxOutRate;
    this.maxLiquidLevel = maxLiquidLevel;
    this.maxOutRate = maxOutRate;
    this.currLiquidLevel = currLiquidLevel;
    this.currConcentration = concentration;
    this.lethalConcentration = lethalConcentration;
    containerList.push(this);
    this.shape = new Shape(xPos, yPos, nameIdentifier, currLiquidLevel, maxLiquidLevel);
}

// Global arrays to store all containers and nodes in existence.
let containerList = [];
let nodeList = [];

// getNodeRate will return the current rate of a FlowNode added with an accumulator value
// @param accumulator: Accumulator used with the Array.reduce() method
// @param nodeIn: FlowNode in
// @return: current rate of nodeIn as a number added with accumulator
function getNodeRate(accumulator, nodeIn) {
    return accumulator + nodeIn.currRate;
}

// getMachingInNodeArray will return FlowNodes that match the input of the specified container
// @param nameIdentifier: nameIdentifier of the specified container
// @return: array of FlowNodes that match the input of the specified container
function getMatchingInNodeArray(nameIdentifier) {
    return nodeList.reduce((acc, node) => {
        if (node.outputToContainer == nameIdentifier) {
            acc.push(node);
        }
        return acc;
    }, []);
}

// getMatchingOutNodeArray will return FlowNodes that match the output of the specified container
// @param nameIdentifier: nameIdentifier of the specified container
// @return: array of FlowNodes that match the output of the specified container
//     Author note: Yes, getMatchingInNodeArray and this function can be made into one using the 
//     [] way to access object values-- however, when I tried, my program started to not function
//     correctly, so I reverted it
function getMatchingOutNodeArray(nameIdentifier) {
    return nodeList.reduce((acc, node) => {
        if (node.inputFromContainer == nameIdentifier) {
            acc.push(node);
        }
        return acc;
    }, []);
}

// findContainer will parse through the list of containers and return a container with the
// matching name
// @param containerName: a string that is the nameIdentifier of the container to return
// @return: specified container
// @return: null if no container is found
//      Author note: reduce() here is slightly slower than this for loop
function findContainer(containerName) {
    for (let i = 0; i < containerList.length; i++) {
        if (containerList[i].nameIdentifier == containerName) {
            return containerList[i];
        }
    }
    //console.log("ERROR: CONTAINER NOT FOUND");
    return null;
}

// updateStatus updates ALL values in each FlowNode and Container
// Happens 60 times a second
function updateStatus() {
    // Update a specified container
    function updateContainer(container) {
        //console.log(container.nameIdentifier + "|| Level: " + container.currLiquidLevel + " || Conc: " + container.currConcentration);
        // Update any inNodes and any outNodes that may have been added
        container.inNodes = getMatchingInNodeArray(container.nameIdentifier);
        container.outNodes = getMatchingOutNodeArray(container.nameIdentifier);

        // Store in rates and out rates
        let inRate = container.inNodes.reduce((acc, nodeIn) => getNodeRate(acc, nodeIn), 0);
        let outRate = container.outNodes.reduce((acc, nodeOut) => getNodeRate(acc, nodeOut), 0);
        let concentrationRateIn = container.inNodes.reduce((acc, nodeIn, index) => {
            return acc + nodeIn.currRate * container.inNodes[index].currConcentration * 100;
        }, 0);

        // Calculate new substance amount inside current container by using
        // a linear first order ODE
        let currSubstanceAmt = container.currConcentration * container.currLiquidLevel;
        let yOverX = concentrationRateIn / outRate;
        let newSubstanceAmt = yOverX + ((currSubstanceAmt - yOverX) * Math.exp(-1 * outRate / 60));

        // Update current container liquid level, concentration, and outRate based on previous "snapshot" (1/60 of a second ago)
        container.currInRate = inRate;
        container.currLiquidLevel = container.currLiquidLevel + inRate - outRate;
        if (container.inNodes.length == 0) {
            newSubstanceAmt = container.currLiquidLevel;
        }
        container.currLiquidLevel == 0 ?
            container.currConcentration = 0 :
            container.currConcentration = newSubstanceAmt / container.currLiquidLevel;
        container.currLiquidLevel < container.maxOutRate ?
            container.currOutRate = container.currLiquidLevel :
            container.currOutRate = container.maxOutRate;

        if (container.currConcentration > 1 && startUpdating !== null) {
            alert("End of simulation. Click on reset!");
            $("#toggle-update").text("Start");
            clearInterval(startUpdating);
            startUpdating = null;
        }
    }

    // Update a specified FlowNode
    function updateFlowNode(node) {
        let fromContainer = findContainer(node.inputFromContainer);
        node.currRate = node.percentOutRate * fromContainer.currOutRate;
        node.currConcentration = fromContainer.currConcentration;
    }

    // Update all containers first, then FlowNodes. Order is important.
    containerList.forEach(updateContainer);
    nodeList.forEach(updateFlowNode);

    // Set canvas state to be invalid to trigger an animation update
    s.valid = false;
}

// calculateConcentrationRGB returns an rgb string from light blue to bright
// purple based on the percentage input
// @param percentage: ratio between current concentration and lethal concentration
//              of container
// @return: String in the format rgba(##.##,255,0.5)
function calculateConcentrationRGB(percentage) {
    if (isNaN(percentage)) return "rgba(153,0,255,0.5)";
    let red = Math.floor(102 * (percentage)) + 51;
    let green = Math.floor((-204 * percentage)) + 204;
    return "rgba(" + red + "," + green + ",255,0.5)";
}

//////////////////////////////////////////////////////////////////////////////////
// LIBRARY BY SIMON SARRIS
//////////////////////////////////////////////////////////////////////////////////
// BASE CODE HAS BEEN MODIFIED BY WILLIAM KWOK
//      Modifications are not drastic, they are only modifications
//      to interface my calculations with the output, and added clean 
//      touch capabilities
//////////////////////////////////////////////////////////////////////////////////
// This library allows Canvas elements to be selected and dragged around
// Source: https://github.com/simonsarris/Canvas-tutorials/blob/master/shapes.js
//
// By Simon Sarris
// www.simonsarris.com
// sarris@acm.org
//
// Last update December 2011
//
// Free to use and distribute at will
// So long as you are nice to people, etc

// Constructor for Shape objects to hold data for all drawn objects.
// For now they will just be defined as rectangles.
function Shape(x, y, nameOfContainer, initCapacity, maxCapacity) {
    // This is a very simple and unsafe constructor. All we're doing is checking if the values exist.
    // "x || 0" just means "if there is a value for x, use that. Otherwise use 0."
    // But we aren't checking anything else! We could put "Lalala" for the value of x 
    this.x = x;
    this.y = y;
    this.w = globalWidth;
    this.h = globalHeight;
    this.name = nameOfContainer;
    this.heightFill = Math.floor(initCapacity / maxCapacity * this.h);
    this.fill = "rgba(51, 204, 255, 0.5)";
    this.inPoint = { x: this.x + this.w / 2, y: this.y };
    this.outPoint = { x: this.x + this.w / 2, y: this.y + this.h };
}


// Draws this shape to a given context
Shape.prototype.draw = function (ctx) {
    let container = findContainer(this.name);

    // Draw entire white rectangle background
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Calculate fluid concentration, give color
    let fillInput = calculateConcentrationRGB(container.currConcentration / container.lethalConcentration);

    // Draw fluid level
    ctx.fillStyle = fillInput;
    this.heightFill = Math.floor(container.currLiquidLevel / container.maxLiquidLevel * this.h);
    ctx.fillRect(this.x, this.y + this.h, this.w, -this.heightFill);

    // Draw title
    ctx.fillStyle = "#000000";
    ctx.font = globalNameSize + "px Myriad Pro";
    ctx.fillText(this.name, this.x, this.y - 10);
}

// Determine if a point is inside the shape's bounds
Shape.prototype.contains = function (mx, my) {
    // All we have to do is make sure the Mouse X,Y fall in the area between
    // the shape's X and (X + Width) and its Y and (Y + Height)
    return (this.x <= mx) && (this.x + this.w >= mx) &&
        (this.y <= my) && (this.y + this.h >= my);
}

function CanvasState(canvas) {
    // **** First some setup! ****
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = canvas.getContext('2d');
    // This complicates things a little but but fixes mouse co-ordinate problems
    // when there's a border or padding. See getMouse for more detail
    let stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;
    if (document.defaultView && document.defaultView.getComputedStyle) {
        this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
        this.stylePaddingTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10) || 0;
        this.styleBorderLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10) || 0;
        this.styleBorderTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10) || 0;
    }
    // Some pages have fixed-position bars (like the stumbleupon bar) at the top or left of the page
    // They will mess up mouse coordinates and this fixes that
    let html = document.body.parentNode;
    this.htmlTop = html.offsetTop;
    this.htmlLeft = html.offsetLeft;

    // **** Keep track of state! ****

    this.valid = false; // when set to false, the canvas will redraw everything
    this.dragging = false; // Keep track of when we are dragging
    // the current selected object. In the future we could turn this into an array for multiple selection
    this.selection = null;
    this.dragoffx = 0; // See mousedown and mousemove events for explanation
    this.dragoffy = 0;

    // **** Then events! ****

    // This is an example of a closure!
    // Right here "this" means the CanvasState. But we are making events on the Canvas itself,
    // and when the events are fired on the canvas the variable "this" is going to mean the canvas!
    // Since we still want to use this particular CanvasState in the events we have to save a reference to it.
    // This is our reference!
    let myState = this;

    //fixes a problem where double clicking causes text to get selected on the canvas
    canvas.addEventListener('selectstart', function (e) { e.preventDefault(); return false; }, false);

    // Up, down, and move are for dragging
    canvas.addEventListener('mousedown', function (e) {
        let mouse = myState.getMouse(e);
        let mx = mouse.x;
        let my = mouse.y;

        for (let i = containerList.length - 1; i >= 0; i--) {
            if (containerList[i].shape.contains(mx, my)) {
                let mySel = containerList[i].shape;
                myState.draggoffx = mx - mySel.x;
                myState.draggoffy = my - mySel.y;
                myState.dragging = true;
                myState.selection = mySel;
                myState.valid = false;
                return;
            }
        }

        // havent returned means we have failed to select anything.
        // If there was an object selected, we deselect it
        if (myState.selection) {
            myState.selection = null;
            myState.valid = false; // Need to clear the old selection border
        }
    }, true);

    canvas.addEventListener('touchstart', function (e) {
        let mouse = myState.getTouch(e);
        let mx = mouse.x;
        let my = mouse.y;

        for (let i = containerList.length - 1; i >= 0; i--) {
            if (containerList[i].shape.contains(mx, my)) {
                let mySel = containerList[i].shape;
                myState.dragoffx = mx - mySel.x;
                myState.dragoffy = my - mySel.y;
                myState.dragging = true;
                myState.selection = mySel;
                myState.valid = false;
                return;
            }
        }

        // havent returned means we have failed to select anything.
        // If there was an object selected, we deselect it
        if (myState.selection) {
            myState.selection = null;
            myState.valid = false; // Need to clear the old selection border
        }
    }, true);
    canvas.addEventListener('mousemove', function (e) {
        if (myState.dragging) {
            let mouse = myState.getMouse(e);
            // We don't want to drag the object by its top-left corner, we want to drag it
            // from where we clicked. Thats why we saved the offset and use it here
            myState.selection.x = mouse.x - myState.dragoffx - globalWidth / 2;
            myState.selection.y = mouse.y - myState.dragoffy - globalHeight / 2;
            myState.selection.inPoint = { x: myState.selection.x + myState.selection.w / 2, y: myState.selection.y };
            myState.selection.outPoint = { x: myState.selection.x + myState.selection.w / 2, y: myState.selection.y + myState.selection.h };
            myState.valid = false; // Something's dragging so we must redraw
        }
    }, true);
    canvas.addEventListener('touchmove', function (e) {
        if (myState.dragging) {
            let mouse = myState.getTouch(e);
            // We don't want to drag the object by its top-left corner, we want to drag it
            // from where we clicked. Thats why we saved the offset and use it here
            myState.selection.x = mouse.x - myState.dragoffx - globalWidth / 9;
            myState.selection.y = mouse.y - myState.dragoffy - globalHeight / 9;
            myState.selection.inPoint = { x: myState.selection.x + myState.selection.w / 2, y: myState.selection.y };
            myState.selection.outPoint = { x: myState.selection.x + myState.selection.w / 2, y: myState.selection.y + myState.selection.h };
            myState.valid = false; // Something's dragging so we must redraw
        }
    }, true);
    canvas.addEventListener('mouseup', function (e) {
        myState.dragging = false;
    }, true);
    canvas.addEventListener('touchend', function (e) {
        myState.dragging = false;
    }, true);

    // **** Options! ****

    this.selectionColor = 'rgba(127,0,0,0.5)';
    this.selectionWidth = 2;
    this.interval = 1; // 20 is where it feels smoother while having significantly less impact on CPU usage
    setInterval(function () { myState.draw(); }, myState.interval);
}

//////////////////////////////////////////////////////////////////////////////////
// DRAW ARROW FUNCTION BY MICURS
//////////////////////////////////////////////////////////////////////////////////
// This function draws an arrow between two points specified
// Source: https://www.snip2code.com/Snippet/265248/HTML5-Canvas--drawing-an-arrow-at-the-en
// @param p1, p2: array of numbers in the format [x, y]
// @param percentage: ratio of concentration to lethalconcentration of container
CanvasState.prototype.arrowDraw = function (p1, p2, percentage) {
    this.ctx.save();
    var dist = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
    this.ctx.beginPath();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = calculateConcentrationRGB(percentage);
    this.ctx.fillStyle = calculateConcentrationRGB(percentage);
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();

    var angle = Math.acos((p2.y - p1.y) / dist);

    if (p2.x < p1.x) angle = 2 * Math.PI - angle;

    var size = 15;

    this.ctx.beginPath();
    this.ctx.translate(p2.x, p2.y);
    this.ctx.rotate(-angle);
    this.ctx.lineWidth = 2;
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(-size, -size);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(size, -size);
    this.ctx.lineTo(0, -size);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
}

CanvasState.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.width, this.height);
}

// While draw is called as often as the INTERVAL variable demands,
// It only ever does something if the canvas gets invalidated by our code
CanvasState.prototype.draw = function () {
    // if our state is invalid, redraw and validate!
    if (!this.valid) {
        let ctx = this.ctx;
        this.clear();

        // ** Add stuff you want drawn in the background all the time here **

        // draw all shapes
        for (let i = 0; i < containerList.length; i++) {
            let shape = containerList[i].shape;
            if (shape.x > this.width || shape.y > this.height ||
                shape.x + shape.w < 0 || shape.y + shape.h < 0) continue;
            shape.draw(ctx);
        }

        // draw all arrows
        for (let i = 0; i < nodeList.length; i++) {
            let inContainer = findContainer(nodeList[i].inputFromContainer);
            let outContainer = findContainer(nodeList[i].outputToContainer);
            let pointOne = inContainer.shape.outPoint;
            if (outContainer != null) {
                let pointTwo = outContainer.shape.inPoint;
                this.arrowDraw(pointOne, pointTwo, inContainer.currConcentration / inContainer.lethalConcentration);
            }
        }

        // draw selection
        // right now this is just a stroke along the edge of the selected Shape
        if (this.selection != null) {
            ctx.strokeStyle = this.selectionColor;
            ctx.lineWidth = this.selectionWidth;
            let mySel = this.selection;
            ctx.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h); ///////////// ADD STUFF UNDER HERE TO DRAW WHEN SELECTED

            // Draw container details
            let container = findContainer(mySel.name);
            ctx.fillStyle = "#000000";
            ctx.font = globalDataSize + "px Myriad Pro";
            ctx.fillText(`Concentration: ${isNaN(container.currConcentration) ? "N/A" : container.currConcentration.toFixed(globalAccuracy)} ${globalSubstance}/${globalFluidUnits}`, mySel.x + mySel.w + 10, mySel.y + 12);
            ctx.fillText(`Lethal concentration: ${container.lethalConcentration.toFixed(globalAccuracy)} ${globalFluidUnits}`, mySel.x + mySel.w + 10, mySel.y + 26)
            ctx.fillText(`Current fluid level: ${container.currLiquidLevel.toFixed(globalAccuracy)} ${globalFluidUnits}`, mySel.x + mySel.w + 10, mySel.y + 38);
            ctx.fillText(`Input flow: ${container.currInRate.toFixed(globalAccuracy)} ${globalFluidUnits}/${globalTimeUnits}`, mySel.x + mySel.w + 10, mySel.y + 52);
            ctx.fillText(`Output flow: ${container.currOutRate.toFixed(globalAccuracy)} ${globalFluidUnits}/${globalTimeUnits}`, mySel.x + mySel.w + 10, mySel.y + 66);
        }

        // ** Add stuff you want drawn on top all the time here **

        this.valid = true;
    }
}


// Creates an object with x and y defined, set to the mouse position relative to the state's canvas
// If you wanna be super-correct this can be tricky, we have to worry about padding and borders
CanvasState.prototype.getMouse = function (e) {
    let element = this.canvas, offsetX = 0, offsetY = 0, mx, my;

    // Compute the total offset
    if (element.offsetParent !== undefined) {
        do {
            offsetX += element.offsetLeft;
            offsetY += element.offsetTop;
        } while ((element = element.offsetParent));
    }

    // Add padding and border style widths to offset
    // Also add the <html> offsets in case there's a position:fixed bar
    offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
    offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

    mx = e.pageX - offsetX;
    my = e.pageY - offsetY;

    // We return a simple javascript object (a hash) with x and y defined
    return { x: mx, y: my };
}

CanvasState.prototype.getTouch = function (e) {
    let element = this.canvas, offsetX = 0, offsetY = 0, mx, my;

    // Compute the total offset
    if (element.offsetParent !== undefined) {
        do {
            offsetX += element.offsetLeft;
            offsetY += element.offsetTop;
        } while ((element = element.offsetParent));
    }

    // Add padding and border style widths to offset
    // Also add the <html> offsets in case there's a position:fixed bar
    offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
    offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

    mx = e.touches[0].pageX - offsetX;
    my = e.touches[0].pageY - offsetY;

    // We return a simple javascript object (a hash) with x and y defined
    return { x: mx, y: my };
}

/////////////////////////////////////////END LIBRARY///////////////////////////////


// SETUP FOR PAGE RUN
// Create canvas variable, get sizes, and create new CanvasState
// Default mobile height and width
let globalWidth = 100;
let globalHeight = 50;
let globalAccuracy = 2; // Decimal point accuracy
let globalNameSize = 15;
let globalDataSize = 10;
let globalSubstance = "substance";
let globalFluidUnits = "L";
let globalTimeUnits = "s";
let globalMidpointX = ($(document).width() - $("#sidebar").width()) / 2 + $("#sidebar").width();
if ($(document).width() < 598) {
    globalMidpointX = $(document).width() / 2;
} else {
    globalMidpointX = ($(document).width() - $("#sidebar").width()) / 2 + $("#sidebar").width();
}
let globalMidpointY = $(document).height() / 2;

// Larger containers for non-mobile
function checkSize() {
    if ($(document).width() > 598) {
        globalWidth = 200;
        globalHeight = 100;
        globalNameSize = 30;
        globalDataSize = 15;
        globalAccuracy = 10;
    } else {
        globalWidth = 100;
        globalHeight = 50;
        globalNameSize = 15;
        globalDataSize = 10;
        globalAccuracy = 2;
    }
}

let x = document.getElementById('canvas');
x.width = $(document).width();
x.height = $(document).height();
let s = new CanvasState(x);

// initialize function is called upon page load and double checks the size of the page
// to determine what box sizes must be
function init() {
    checkSize();
    containerList = [];
    nodeList = [];
}

// Resized resets the canvas state to be the same size as the document
// So items are not stretched.
function resized() {
    checkSize();
    x.width = $(document).width();
    x.height = $(document).height();
    if (x.width < 598) {
        globalMidpointX = x.width / 2 - 200;
    } else {
        globalMidpointX = (x.width - $("#sidebar").width()) / 2 + $("#sidebar").width();
    }
    let globalMidpointY = x.height / 2;
    let s = new CanvasState(x);
}

// On window load run initialize
window.onload = function () {
    init();
    s.valid = false;
}

// On window resize run resized() and set canvas state to false to refresh canvas
window.onresize = function () {
    resized();
    s.valid = false;
}

// Toggle the flow
let startUpdating = null;
$("#toggle-update").click((e) => {
    if (startUpdating !== null) {
        $(e.target).text("Start");
        clearInterval(startUpdating);
        startUpdating = null;
    } else {
        $(e.target).text("Stop");
        startUpdating = setInterval(() => {
            updateStatus();
        }, 16);
    }
});

$("#reset-button").click(() => {
    resetContainerStates();
})

// Node queues for flow nodes later
let flowNodeQueue = [];

// getValue returns the value of the specified id in the DOM
// @param id: id of object in the DOM (no hash)
// @return: a jquery object of the specified id's first element
//      Author note: For some reason, the $ operator was just giving me an
//      array rather than the item itself, so this makes it easier to type later on
function getId(id) {
    return $(`#${id}`)[0];
}

// When the add node button is pressed...
$("#add-node-btn").click(() => {
    // Take in the current input of the flow rate and output container inputs
    let flowRate = parseFloat(getId("flow-rate").value);
    let outputTo = getId("output-container").value;

    // Add the data to the flow node queue (no input validation here)
    flowNodeQueue.push({ flow: flowRate, outTo: outputTo });

    // Create new display node that removes itself when you click on it
    // Also clears out the node queue of the selected node
    let addNode = $("<p>", { class: "node-select" });
    addNode.text(`${flowRate * 100}% output to ${outputTo}`);
    addNode.click((e) => {
        let index = $(e.target).index();
        flowNodeQueue.splice(index, 1);
        $(e.target).remove();
    })
    $("#flow-outputs").append(addNode);

    // Clear inputs
    getId("flow-rate").value = "";
    getId("output-container").value = "";
})

// checkAlert takes in parameters and returns an error message if an invalid container
// is trying to be made.
// @param containerName: name of Container
// @param maxOutRate: maximum out rate of a container
// @param startLiquidLevel: starting liquid level container
// @param maxCap: maximum capacity of container
// @param initConcentration: initial concentration of the container
// @param lethalConcentration: lethal concentration of container
// @return: an object that contains a boolean true or false if it passes or not as well
//          as an error message if it failed.
function checkAlert(containerName, maxOutRate, startLiquidLevel, maxCap, initConcentration, lethalConcentration) {
    let returnVal = { bool: false, errorMsg: "" };

    // Calculate total outrate. Does not let it exceed 1
    let outRatePercentage = flowNodeQueue.reduce((acc, node) => {
        return acc + node.flow;
    }, 0);
    if (maxOutRate > startLiquidLevel) {
        returnVal.errorMsg = "starting liquid level cannot be less than the maximum output rate!";
    } else if (initConcentration > 1.0) {
        returnVal.errorMsg = "initial concentration cannot be greater than 1!"
    } else if (startLiquidLevel > maxCap) {
        returnVal.errorMsg = "starting liquid level cannot be greater than the maximum capacity!";
    } else if (outRatePercentage > 1) {
        returnVal.errorMsg = "flow outputs sum must not exceed 1"
    } else if (maxOutRate > maxCap) {
        returnVal.errorMsg = "maximum out rate cannot be greater than maximum capacity!";
    } else {
        returnVal.bool = true;
    }
    return returnVal;
}

// Store default container states of the sequence
let defaultContainerStates = [];

// When the add container button is clicked...
$("#add-container-btn").click(() => {
    // Take in current input arguments
    let containerName = getId("container-name").value;
    let maxOutRate = parseFloat(getId("max-out-rate").value);
    let startLiquidLevel = parseFloat(getId("start-liquid-lvl").value);
    let maxCap = parseFloat(getId("max-capacity").value);
    let initConcentration = parseFloat(getId("init-concentration").value);
    let lethalConcentrationIn = parseFloat(getId("lethal-concentration").value);

    // Check if container is valid
    let alertCheck = checkAlert(containerName, maxOutRate, startLiquidLevel, maxCap, initConcentration, lethalConcentrationIn);

    // If the container isn't valid, do nothing except send an alert
    if (!alertCheck.bool) {
        alert(`ERROR: ${alertCheck.errorMsg}`);
    } else {
        // Otherwise, add it to the defaultContainerStates
        defaultContainerStates.push({
            name: containerName,
            maxOut: maxOutRate,
            startLevel: startLiquidLevel,
            maxCapacity: maxCap,
            startConcentration: initConcentration,
            lethalConcentration: lethalConcentrationIn
        })

        // Create a place for it in the sidebar box
        // When clicked, it removes itself from the defaultContainerStates
        // along with the containerList
        let addNode = $("<p>", { class: "container-select" });
        addNode.text(`${containerName}`);
        addNode.click((e) => {
            let index = $(e.target).index();
            let name = $(e.target).text();
            defaultContainerStates.splice(index, 1);
            $(e.target).remove();
            containerList.splice(index, 1);
            removeNodesComingOutFrom(name);
            resetContainerStates();
        });

        // Add the node and then clear all the values in the inputs
        $("#container-nodes").append(addNode);
        getId("container-name").value = "";
        getId("max-out-rate").value = "";
        getId("start-liquid-lvl").value = "";
        getId("max-capacity").value = "";
        getId("flow-rate").value = "";
        getId("init-concentration").value = "";
        getId("lethal-concentration").value = "";

        // create the flownodes that were in the queue, then clear the queue
        // and input boxes
        flowNodeQueue.forEach((node) => {
            new FlowNode(node.flow, containerName, node.outTo);
        })
        flowNodeQueue = [];
        getId("output-container").value = "";
        getId("flow-outputs").innerHTML = "";

        // Add the new container to display and containerList
        addContainers(containerName, maxOutRate, startLiquidLevel, maxCap, initConcentration, lethalConcentrationIn);
    }
})

// removeNodesComingOutFrom removes the flow nodes coming out from the specified container
// @param name: name of container to remove nodes from
function removeNodesComingOutFrom(name) {
    nodeList = nodeList.filter((node) => { node.inputFromContainer == name });
}

// resetContainerStates resets all containers back to their default state
function resetContainerStates() {
    defaultContainerStates.forEach((container, index) => {
        containerList[index].currLiquidLevel = container.startLevel;
        containerList[index].currConcentration = container.startConcentration;
    })
    nodeList.forEach((node) => {
        node.currRate = findContainer(node.inputFromContainer).currOutRate * node.percentOutRate;
    })
    s.valid = false;
}

// addContainers creates a new container based on the parameters given
// @param containerName: container name
// @param maxOutRate: maxmimum output rate of container
// @param startLiquidLevel: starting liquid level of container
// @param maxCap: maximum capacity of container
// @param initConcentration: initial concentration of container
// @param lethalConcentration: lethal concentration of container
//      Author note: This function is similar to resetContainerStates, but
//              a duplication of it is necessary to function correctly
function addContainers(containerName, maxOutRate, startLiquidLevel, maxCap, initConcentration, lethalConcentration) {
    defaultContainerStates.forEach((container, index) => {
        if (index < defaultContainerStates.length - 1) {
            containerList[index].currLiquidLevel = container.startLevel;
            containerList[index].currConcentration = container.startConcentration;
        } else {
            let r = new Container(maxOutRate, startLiquidLevel, maxCap, containerName, globalMidpointX, globalMidpointY, initConcentration, lethalConcentration);
        }
    })
    nodeList.forEach((node) => {
        node.currRate = findContainer(node.inputFromContainer).currOutRate * node.percentOutRate;
    })
    s.valid = false;
}

// Whenever volume units input box is changed, the global units for volume changes
$("#vol-units").on("input", (e) => {
    globalFluidUnits = e.target.value;
    s.valid = false;
});

// Whenever the time units input box is changed, the global units of time changes
$("#time-units").on("input", (e) => {
    globalTimeUnits = e.target.value;
    s.valid = false;
});

// Clears everything when the clear button is pressed
$("#clear-all").click(() => {
    clearEverything();
})

// Function for clearing everything
function clearEverything() {
    defaultContainerStates = [];
    containerList = [];
    nodeList = [];
    getId("container-nodes").innerHTML = "";
    s.valid = false;
}

// When demo button is clicked, a demo is set up
$("#demo").click(() => {
    clearEverything();
    // Set up some test FlowNodes, Containers, and set Rates
    new FlowNode(1, "drugsIn", "stomach");
    new FlowNode(1, "stomach", "small intestine");
    new FlowNode(0.5, "small intestine", "large intestine");
    new FlowNode(0.5, "small intestine", "bloodstream");
    new FlowNode(0.5, "large intestine", "bloodstream");
    new FlowNode(0.5, "large intestine", "out");
    new FlowNode(0.25, "bloodstream", "liver");
    new FlowNode(0.5, "liver", "bloodstream");
    new FlowNode(0.5, "liver", "out");
    new FlowNode(0.25, "bloodstream", "brain");
    new FlowNode(1, "brain", "bloodstream");

    // new Container(maxOutRate, currLiquidLevel, maxLiquidLevel, nameIdentifier, xpos,ypos, concentration)
    new Container(0.5, 500, 500, "drugsIn", globalMidpointX - 10, globalMidpointY - 200, 1, 1);
    new Container(0.1, 300, 800, "stomach", globalMidpointX, globalMidpointY - 150, 0, 0.9);
    new Container(0.1, 300, 500, "small intestine", globalMidpointX + 10, globalMidpointY - 100, 0, 0.4);
    new Container(0.1, 300, 500, "large intestine", globalMidpointX, globalMidpointY - 50, 0, 0.5);
    new Container(0.2, 300, 2000, "bloodstream", globalMidpointX - 10, globalMidpointY, 0, 0.015);
    new Container(0.1, 0, 4000, "out", globalMidpointX, globalMidpointY + 50, 0, 0.5);
    new Container(0.1, 300, 500, "liver", globalMidpointX + 10, globalMidpointY + 100, 0, 0.007);
    new Container(0.1, 300, 500, "brain", globalMidpointX, globalMidpointY + 100, 0, 0.5);

    nodeList.forEach((node) => {
        node.currRate = findContainer(node.inputFromContainer).currOutRate * node.percentOutRate;
    })

    containerList.forEach((container) => {
        defaultContainerStates.push({
            name: container.nameIdentifier,
            maxOut: container.maxOutRate,
            startLevel: container.currLiquidLevel,
            maxCapacity: container.maxLiquidLevel,
            startConcentration: container.currConcentration,
            lethalConcentration: container.lethalConcentration
        })
        let addNode = $("<p>", { class: "container-select" });
        addNode.text(`${container.nameIdentifier}`);
        addNode.click((e) => {
            let index = $(e.target).index();
            let name = $(e.target).text();
            defaultContainerStates.splice(index, 1);
            $(e.target).remove();
            containerList.splice(index, 1);
            removeNodesComingOutFrom(name);
            resetContainerStates();
        });

        // Add the node and then clear all the values in the inputs
        $("#container-nodes").append(addNode);
    })
})

// These buttons toggle the sidebar when they're pressed
$("#sidebar-button").click(() => {
    $("#sidebar").css("display", "inline");
});

$("#close-sidebar").click(() => {
    $("#sidebar").css("display", "none");
})