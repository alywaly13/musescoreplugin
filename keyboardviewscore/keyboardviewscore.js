var F5 = 77;
var C4 = 60;
var G2 = 43;

var NOTE_DISTANCE = 5;
var WHITE_KEY_WIDTH = 56;
var BLACK_KEY_WIDTH = 38;
var WHITE_KEY_HEIGHT = NOTE_DISTANCE*2;
var BLACK_KEY_HEIGHT = WHITE_KEY_HEIGHT - 2;
var LINE_WIDTH = 3;
var SPACE_BETWEEN = 2*WHITE_KEY_HEIGHT - LINE_WIDTH;
var STAFF_HEIGHT = 5*LINE_WIDTH + 4*SPACE_BETWEEN;

var pngImages;
var scene;
var measuresInfo;
var numberOfMeasures;
var progress;
var currentProgressStep;


function init() {
    pngImages = new PNGImages();
};


function run() {
    // Add initial UI
    var loader = new QUiLoader(null);
    var file = new QFile(pluginPath + "/keyboardviewscore.ui");
    file.open(QIODevice.OpenMode(QIODevice.ReadOnly, QIODevice.Text));
    var form = loader.load(file, null);

    //
    // Set QGraphicView
    //
    scene = new QGraphicsScene();
    form.graphicsView.setScene(scene);
    form.graphicsView.alignment = Qt.AlignTop | Qt.AlignLeft;
    form.graphicsView.backgroundBrush = new QBrush(QColor.fromRgb(244, 238, 217), Qt.SolidPattern);

    //
    // Add Layout
    //
    var layout = new QGridLayout();
    layout.addWidget(form.graphicsView, 0, 0, Qt.Alignment.AlignJustify);
    layout.setContentsMargins(0,0,0,0);
    form.setLayout(layout);

    //
    // Render score
    //
    if(drawScore()===-1) {
        progress.reset();
        return;
    }

    form.show();
};


function close() {};


var mscorePlugin =
{
   majorVersion: 1,
   minorVersion: 1,
   menu: 'Plugins.Keyboard View Score',
   init: init,
   run: run,
   onClose: close
};

mscorePlugin;


//-------------------------------------------------------------------------------------------------------
//
// Section 1
// Functions called by init() and run():
// PNGImages, drawScore
//
//-------------------------------------------------------------------------------------------------------
function PNGImages(scale) {
    this.imageArray = new Array();
    this.nameArray = new Array();
    var qDir = new QDir(pluginPath+ "/images/");
    var list = qDir.entryList();
    for(var i=0; i<list.length; i++) {
        if(list[i]!=="." && list[i]!=="..") {
            this.nameArray.push(list[i])
            var pixmap = new QPixmap(pluginPath + "/images/" + list[i]);
            this.imageArray.push(pixmap);
        }
    }
    this.getImage = function(name) {
        for(var i=0; i<this.nameArray.length; i++)
            if(this.nameArray[i]===name) return this.imageArray[i];
    };
}


function drawScore()
{
    setMeasuresInfo();

    numberOfMeasures = measuresInfo.length-1;  // The last value is just the tick length of the last measure.
    var progressSteps = numberOfMeasures + curScore.staves;
    progress = new QProgressDialog("Rendering score...", "Cancel", 0, progressSteps, this);
    progress.modal = true;
    currentProgressStep = 0;

    if(fillMeasuresInfo()===-1)
        return -1;

    var origin = scene.addText("");
    origin.pos = new QPointF(0,0);

    drawHeader(30, 0);

    var lastX = drawStaves(10,120);
    if(lastX === -1)
        return -1;

    var endReference = scene.addText("");
    endReference.pos = new QPointF(lastX+50, 0);

    return 0;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 2
// Functions called by run -> drawScore():
// setMeasuresInfo, fillMeasuresInfo, drawHeader, drawStaves
//
//-------------------------------------------------------------------------------------------------------
function setMeasuresInfo() {
    measuresInfo = new Array();
    var measureTick = getMeasureTick(0);
    var measureNumber = 0;
    // getMeasureTick() returns -measureTick to signal it is the last value.
    while(measureTick >= 0) {
        measuresInfo.push(new Measure(measureNumber, measureTick));
        measureNumber++;
        measureTick = getMeasureTick(measureNumber);
    }
    measuresInfo.push(new Measure(measureNumber, -measureTick));
}


function fillMeasuresInfo() {
        var cursor = new Cursor(curScore);
        for(measureNumber = 0; measureNumber < numberOfMeasures; measureNumber++) {
            var minimumTickLength = 1920; // Whole note tick length;
            var measureEndTick = measuresInfo[measureNumber+1].tick;
            for(staffNumber = 0; staffNumber < curScore.staves; staffNumber++) {
                measuresInfo[measureNumber].chordsInTickInStaff[staffNumber] = new Array();
                var ticksArray = measuresInfo[measureNumber].chordsInTickInStaff[staffNumber];
                for(var voiceNumber=0; voiceNumber<4; voiceNumber++) {
                    if(placeCursorAt(cursor, staffNumber, measureNumber, voiceNumber)===false)
                        continue;
                    var tick = cursor.tick();
                    while(tick < measureEndTick) {
                        if(cursor.isChord()===true || cursor.isRest()===true) {
                            // Search for an array with chords in this tick.
                            for(var tickIndex = 0; tickIndex < ticksArray.length; tickIndex++)
                                if(ticksArray[tickIndex].tick === tick)
                                    break;
                            if(tickIndex === ticksArray.length)
                                ticksArray.push(new Tick(tick));
                            if(cursor.isChord()===true) {
                                var chord = cursor.chord();
                                ticksArray[tickIndex].chords.push(new ChordObject(voiceNumber, chord));
                                minimumTickLength = Math.min(chord.tickLen, minimumTickLength);
                            }
                            else {
                                var rest = cursor.rest();
                                var len = rest.tickLen;
                                ticksArray[tickIndex].chords.push(new RestObject(voiceNumber, rest));
                                minimumTickLength = Math.min(rest.tickLen, minimumTickLength);
                            }

                        }
                        if(cursor.eos()===false) {
                            cursor.next();
                            tick = cursor.tick();
                        }
                        else
                            break;
                    }
                }
                for(tickIndex = 0; tickIndex < ticksArray.length; tickIndex++)
                    ticksArray[tickIndex].chords.sort(compareChordObjects);
                ticksArray.sort(compareTicks);

            }
            measuresInfo[measureNumber].minimumTickLength = minimumTickLength;

            currentProgressStep++;
            progress.setValue(currentProgressStep);
            progress.labelText = "Rendering score... (measure "+measureNumber+")";
            if (progress.wasCanceled===true)
                return -1;

        }
        return 0;
}


function drawHeader(x, y) {
    var font = new QFont("Times New Roman", 10);
    var textItem = scene.addText("(*) White keys are shown with white notes, black keys are shown with black notes:", font);
    textItem.pos = new QPointF(x,y);

    var whiteQuarter = pngImages.getImage("quarter_up_wh.png");
    whiteQuarter = whiteQuarter.scaled(whiteQuarter.width()/3, whiteQuarter.height()/3);
    var blackQuarter = pngImages.getImage("quarter_up_bl.png");
    blackQuarter = blackQuarter.scaled(blackQuarter.width()/3, blackQuarter.height()/3);

    x += 450;
    var whiteItem = scene.addPixmap(whiteQuarter);
    whiteItem.setOffset(x, y-10);

    x += 20;
    var equalItem1 = scene.addText("=", font);
    equalItem1.pos = new QPointF(x,y);

    x += 20;
    var blackItem = scene.addPixmap(blackQuarter);
    blackItem.setOffset(x, y-10);

    x += 20;
    var equalItem2 = scene.addText("=   Quarter note. (Half notes are shown with squared note heads.)", font);
    equalItem2.pos = new QPointF(x,y);
}


function drawStaves(x,y) {
    var staffNumber = 0;
    var partNumber=0;
    var lastX;

    var nameMaxLength = getNameMaxLength();

    while(partNumber < curScore.parts) {
        var part = curScore.part(partNumber);
        var textItem;

        var partShortName = part.shortName;
        if(partShortName === "")
            partShortName = part.longName;

        if(part.staves===1) {
            textItem = scene.addText(part.longName, new QFont("Times New Roman", 12));
            textItem.pos = new QPointF(x,y+STAFF_HEIGHT/3);

            lastX = drawSingleStaff(x+nameMaxLength*8, y, staffNumber, partShortName, guessClef(staffNumber));
            y+= 200;
            currentProgressStep++;
            progress.setValue(currentProgressStep);
            if (progress.wasCanceled===true)
                return -1;
        }
        else {
            textItem = scene.addText(part.longName, new QFont("Times New Roman", 12));
            textItem.pos = new QPointF(x,y+STAFF_HEIGHT);

            lastX = drawDoubleStaff(x+nameMaxLength*8, y, staffNumber, partShortName);
            y+= 200 + (STAFF_HEIGHT + 2*SPACE_BETWEEN + LINE_WIDTH);
            currentProgressStep += 2;
            progress.setValue(currentProgressStep);
            if (progress.wasCanceled===true)
                return -1;
        }
        staffNumber += part.staves;
        partNumber++;
        progress.labelText = "Finishing rendering... (staff "+staffNumber+")";
    }

    return lastX;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 3.1
// Functions called by run -> drawScore -> setMeasuresInfo():
// getMeasureTick, Measure
//
//-------------------------------------------------------------------------------------------------------
function getMeasureTick(measureNumber) {
        var cursor = new Cursor(curScore);
        var measureTick = -1;
        var eosHit = false;
        for(var staffNumber = 0; staffNumber < curScore.staves; staffNumber++ )
            for(var voiceNumber=0; voiceNumber<4; voiceNumber++) {
                if(nextMeasuresFromOrigin(cursor, staffNumber, measureNumber, voiceNumber)===false)
                    continue;
                if(measureTick === -1)
                    measureTick = cursor.tick();
                else
                    measureTick = Math.min(cursor.tick(), measureTick);
            }

        if(measureTick!==-1)
            return measureTick;
        else {
            // Reached last measure, so get its last entry tick.
            for(staffNumber = 0; staffNumber < curScore.staves; staffNumber++) {
                for(voiceNumber=0; voiceNumber<4; voiceNumber++) {
                    nextMeasuresFromOrigin(cursor, staffNumber, measureNumber, voiceNumber);
                    measureTick = Math.max(cursor.tick(), measureTick);
                }
            }
            return -measureTick;
        }
}


function Measure(measureNumber, measureTick) {
    this.minimumLength = 0;
    this.tick = measureTick;
    this.chordsInTickInStaff = new Array(); // 3D array scheme: [staff][tick][chord]
}


//-------------------------------------------------------------------------------------------------------
//
// Section 3.2
// Functions called by run -> drawScore -> fillMeasuresInfo():
// placeCursorAt, Tick, ChordObject, RestObject, compareChordObjects, compareTicks
//
//-------------------------------------------------------------------------------------------------------
function placeCursorAt(cursor, staffNumber, measureNumber, voiceNumber) {
    cursor.voice = voiceNumber;
    cursor.staff = staffNumber;
    cursor.rewind();

    while(cursor.tick() < measuresInfo[measureNumber].tick)
        if(cursor.eos()===false)
            cursor.nextMeasure();
        else
            return false;
    return true;
}


function Tick(tick) {
    this.tick = tick;
    this.chords = new Array();
}


function ChordObject(voice, chord) {
    this.voice = voice;
    this.chord = chord;
    this.middleNote = (chord.note(0).pitch + chord.topNote().pitch) / 2; // Used to calculate stem direction.
}


function RestObject(voice, rest) {
    this.voice = voice;
    this.restLen = rest.tickLen;
    this.middleNote = -1;
}


function compareChordObjects(chordObjectA, chordObjectB) {
    if(chordObjectA.middleNote===-1) // B has a higher topNote than a rest, so let B have a lower index.
        return 1;
    else if(chordObjectB.middleNote===-1) // A has a higher topNote than a rest, so let A have a lower index.
        return -1;
    else // Both are chords. Let the chord with the highest topNote have the lower index.
        return chordObjectB.chord.topNote().pitch - chordObjectA.chord.topNote().pitch;
}


function compareTicks(tickA, tickB) {
        return tickA.tick - tickB.tick;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 3.3
// Functions called by run -> drawScore -> drawStaves():
// getNameMaxLength, guessClef, drawSingleStaff, drawDoubleStaff
//
//-------------------------------------------------------------------------------------------------------
function getNameMaxLength() {
    var longestName = "";
    for(var partNumber=0; partNumber < curScore.parts; partNumber++) {
        var part = curScore.part(partNumber);
        if(part.longName.length > longestName.length)
            longestName = part.longName;
    }

    return longestName.length;
}


function guessClef(staffNumber) {
    var sampleNotes = 0;
    var staffMiddleNote = 0;
    outer_loop:
    for(var measureNumber = 0; measureNumber < numberOfMeasures; measureNumber++) {
        var ticksArray = measuresInfo[measureNumber].chordsInTickInStaff[staffNumber];
        for(var tickIndex = 0; tickIndex < ticksArray.length; tickIndex++) {
            for(var chordIndex = 0; chordIndex < ticksArray[tickIndex].chords.length; chordIndex++) {
                if(ticksArray[tickIndex].chords[chordIndex].middleNote !== -1) {
                    staffMiddleNote += ticksArray[tickIndex].chords[chordIndex].middleNote;
                    sampleNotes++;
                    if(sampleNotes===10)
                        break outer_loop;
                }
            }
        }
    }
    if(sampleNotes > 0) {
        staffMiddleNote /= sampleNotes;
        if(staffMiddleNote < C4)
            return "F";
    }
    return "G";
}


function drawSingleStaff(x, y, staffNumber, partShortName, clef) {
    x = drawClef(clef, x, y);
    for(var measureNumber = 0; measureNumber < numberOfMeasures; measureNumber++) {
        x = drawMeasure(measureNumber, x, y, staffNumber, clef, partShortName);
    }
    drawDoubleLine(x, y);
    return x;
}


function drawDoubleStaff(x, y, staffNumber, partShortName) {
    x = drawDoubleClef(x, y);
    for(var measureNumber = 0; measureNumber < numberOfMeasures; measureNumber++) {
        x = drawMeasure(measureNumber, x, y, staffNumber, 2, partShortName)
    }
    drawDoubleLine(x, y);
    y += STAFF_HEIGHT + 2*SPACE_BETWEEN + LINE_WIDTH;
    drawDoubleLine(x, y);
    return x;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 4.1
// Functions called by run -> drawScore -> setMeasuresInfo ->  getMeasureTick():
// nextMeasuresFromOrigin
//
//-------------------------------------------------------------------------------------------------------
function nextMeasuresFromOrigin(cursor, staffNumber, nextMeasureTimes, voiceNumber) {
        cursor.voice = voiceNumber;
        cursor.staff = staffNumber;
        cursor.rewind();
        if(cursor.eos()===true)
            return false;
        for(var i=0; i<nextMeasureTimes; i++) {
            cursor.nextMeasure();
            if(cursor.eos()===true)
                return false;
        }
        return true;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 4.2
// Functions called by run -> drawScore -> drawStaves -> drawSingleStaff() & drawDoubleStaff():
// drawClef, drawDoubleClef, drawDoubleLine, drawMeasure
//
//-------------------------------------------------------------------------------------------------------
function drawClef(clef, x, y) {
    var pixmap = pngImages.getImage("clef" + clef + ".png");
    var pixmapItem = scene.addPixmap(pixmap);
    pixmapItem.setOffset(x+20, y - 41);
    drawStaff(x, x+100, y);
    var qPen = new QPen(new QBrush(new QColor("black"), Qt.SolidPattern), LINE_WIDTH);
    scene.addLine(x, y, x, y+STAFF_HEIGHT-LINE_WIDTH, qPen);

    return x+100;
}


function drawDoubleClef(x, y) {
        drawClef("G", x, y);
        return drawClef("F", x, y+STAFF_HEIGHT + 2*SPACE_BETWEEN+LINE_WIDTH);
}


function drawDoubleLine(x, y) {
    var qPen = new QPen(new QBrush(new QColor("black"), Qt.SolidPattern), LINE_WIDTH);
    scene.addRect(x, y, 6, STAFF_HEIGHT - LINE_WIDTH, qPen);
    drawStaff(x, x+6, y);
}


var topVoice;
var keyboardPictureTopNote;
var keyboardPictureBottomNote;

function drawMeasure(measureNumber, measureX, measureY, staffNumber, clef, partShortName) {
    // If we are in a double staff, 'clef' is 2
    // If we are in a single staff, 'clef' is the clef letter ("G", "C" or "F")
    var clefTopNote; // Used in drawNote(). If we're in a single staff measure, also used in getStemDirection()
    if(clef===2) {
        keyboardPictureTopNote = F5;
        keyboardPictureBottomNote = G2;
        numberOfClefs = 2;
    }
    else {
        clefTopNote = getTopNoteFromClef(clef);
        numberOfClefs = 1;
        if(clef==="G")
            keyboardPictureBottomNote = C4;
        else
            keyboardPictureBottomNote = getBottomNoteFromClef(clef);
        if(clef==="F")
            keyboardPictureTopNote = C4;
        else
            keyboardPictureTopNote = clefTopNote;
    }

    var noteArray = new Array();
    var staffY = measureY;
    var endX = getTickX(measureNumber, measureX, measuresInfo[measureNumber+1].tick)+10;
    var measureLength = measuresInfo[measureNumber+1].tick - measuresInfo[measureNumber].tick;

    for(var clefNumber=0; clefNumber<numberOfClefs; clefNumber++) {
        var ticksArray = measuresInfo[measureNumber].chordsInTickInStaff[staffNumber+clefNumber];
        topVoice = -1;
        if(clef === 2)
            clefTopNote = getTopNoteFromClef(clefNumber);
        for(var tickIndex = 0; tickIndex < ticksArray.length; tickIndex++) {
            var tickX = getTickX(measureNumber, measureX, ticksArray[tickIndex].tick);
            var numberOfVoices = ticksArray[tickIndex].chords.length;
            for(var chordIndex = numberOfVoices-1; chordIndex >= 0 ; chordIndex--) { // Rests are in the higher index and should be drawn first (behind).
                var chordObject = ticksArray[tickIndex].chords[chordIndex];

                if(chordObject.middleNote === -1) {
                    if(chordObject.restLen < measureLength) // Don't draw measure rests.
                        drawRest(tickX, staffY, chordObject.restLen);
                    else
                        drawEmptyMeasureRest((measureX+WHITE_KEY_WIDTH+endX)/2-12, staffY);
                }
                else {

                    var stemDirection;
                    if(clef === 2)
                        stemDirection = getStemDirection(numberOfVoices, chordObject, chordIndex, clefNumber);
                    else
                        stemDirection = getStemDirection(numberOfVoices, chordObject, chordIndex, clefTopNote);
                    drawChord(chordObject, measureX, tickX, staffY, stemDirection, clefTopNote, noteArray);
                }
            }
        }
        drawStaff(measureX + WHITE_KEY_WIDTH, endX, staffY);
        staffY+= STAFF_HEIGHT + 2*SPACE_BETWEEN + LINE_WIDTH;
    }

    drawKeyboard(clef, measureX, measureY, keyboardPictureBottomNote, keyboardPictureTopNote, noteArray);

    var measureTextOffset = 40;
    if(clef===2)
        clefTopNote = F5;
    if((measureNumber+1)%5 === 0 && partShortName !== "") {
        var nameY = getNoteCenterY(measureY, clefTopNote, keyboardPictureTopNote) - measureTextOffset;
        var textItem = scene.addText("("+partShortName+")", new QFont("Times New Roman", 8));
        textItem.pos = new QPointF(measureX, nameY);
        measureTextOffset += 20;
    }

    if(staffNumber === 0) {
        var numberY = getNoteCenterY(measureY, clefTopNote, keyboardPictureTopNote) - measureTextOffset;
        textItem = scene.addText(measureNumber+1, new QFont("Times New Roman", 8));
        textItem.pos = new QPointF(measureX, numberY);
    }

    return endX;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 5.1
// Functions called by run -> drawScore -> drawStaves -> drawSingleStaff -> drawClef():
// drawStaff(also by drawMeasure)
//
//-------------------------------------------------------------------------------------------------------
function drawStaff(xi, xf, y)
{
    for (var i = 0; i < 5; i++) {
        scene.addLine(xi, y, xf, y, new QPen(new QBrush(new QColor("black"), Qt.SolidPattern), LINE_WIDTH));
        y+=SPACE_BETWEEN+LINE_WIDTH;
    }
}


//-------------------------------------------------------------------------------------------------------
//
// Section 5.2
// Functions called by run -> drawScore -> drawStaves -> drawSingleStaff & drawDoubleStaff -> drawMeasure():
// getTopNoteFromClef(also by drawKeyboard, drawKey), getBottomNoteFromClef, getTickX, drawRest,
// drawEmptyMeasureRest, getStemDirection, drawChord, drawStaff(shown under drawClef), drawKeyboard
//
//-------------------------------------------------------------------------------------------------------
function getTopNoteFromClef(clef) {
    switch(clef) {
    case 0:
    case "G":
        return F5;
    case 1:
    case "F":
        return 57; // A3
    case "C":
        return 67; // G4
    }
}


function getBottomNoteFromClef(clef) {
    switch(clef) {
    case "G":
        return 64; // E4
    case "C":
        return 53; // F3
    case "F":
        return G2;
    }
}


function getTickX(measureNumber, measureX, tick) {
    var measureBeginTick = measuresInfo[measureNumber].tick;
    var minimumTickLength = measuresInfo[measureNumber].minimumTickLength;
    // The value of 40 is the minimum space in pixels between notes.
    return Math.floor(measureX + WHITE_KEY_WIDTH + 20 + ((tick - measureBeginTick)/minimumTickLength)*40);
}


function drawRest(restX, staffY, tickLength) {
    var noteDuration = getNoteDurationFromTickLength(tickLength);
    if(noteDuration.durationName === "")
        return;
    var image = pngImages.getImage(noteDuration.durationName + "_rest.png");
    var pixmapItem = scene.addPixmap(image);
    var restY = staffY - 26;
    pixmapItem.setOffset(restX, restY);

    if(noteDuration.durationModifier !==0 )
        drawDurationModifier(noteDuration.durationModifier, restX, restY, "rest");
}


function drawEmptyMeasureRest(restX, staffY)  {
    var image = pngImages.getImage("whole_rest.png");
    var pixmapItem = scene.addPixmap(image);

    var restY = staffY - 26;
    pixmapItem.setOffset(restX, restY);
}


function getStemDirection(numberOfVoices, chordObject, chordIndex, clef) {
    // If we are in a double staff, 'clef' is 0 or 1
    // If we are in a single staff, 'clef' is the clefTopNote (F5, G4 or A3)

    var stemDirection;
    // If there is only one voice in this tick...
        if(numberOfVoices === 1) {
        // ...and there was only one voice in the measure until now...
        if(topVoice === -1) {
            // ...then goes "up" for the G clef and "down" for the F clef if we're in a double staff...
            if(clef === 0)
                stemDirection = "up";
            else if(clef === 1)
                stemDirection = "down";
            // ...or follows the normal direction if we're in a single staff,
            else {
                if(intervalInWhiteKeys(chordObject.middleNote, clef)>4) stemDirection = "up";
                else stemDirection = "down";
            }
        }
        // If there is only one voice in this tick, but there was a top voice set before,
        // follows the stem direction based on the top voice set before.
        else if(topVoice === chordObject.voice)
            stemDirection = "up";
        else
            stemDirection = "down";
    }
    // If there is more than one chord in this tick,
    // sets the chord with the highest top note to stems up, the others to stem down.
    // (The chord order set in fillMeasuresInfo() sorted the chords
    // from the highest top note to the lowest, with the highest chord at index 0)
    else if(chordIndex === 0) {
        topVoice = chordObject.voice;
        stemDirection = "up";
    }
    else
        stemDirection = "down";
    return stemDirection;
}


function drawChord(chordObject, measureX, tickX, staffY, stemDirection, clefTopNote, noteArray) {
    var chord = chordObject.chord;

    // Discovers which note will have the leading stem.
    // In n-quaver chords, the leading note is the only one with the stem drawn completely.
    var leadingStemIndex;
    if(stemDirection === "up")
        leadingStemIndex = chord.notes - 1;
    else
        leadingStemIndex = 0;

    var chordX = tickX;
    if(stemDirection === "up")
        chordX += 2; // Don't collide with stems downs in other voices.

    for(var i=0; i<chord.notes; i++) {
        var drawDuration = chord.tickLen;
        // If the chord is a n-quaver, draws quarter notes simple stems under the leading note
        // complete stem.
        if(i!==leadingStemIndex && drawDuration < 480)
            drawDuration = 480;
        var note = chord.note(i);
        drawNote(clefTopNote, chordX, staffY, note.pitch, drawDuration, stemDirection);

        if(noteArray.indexOf(note.pitch)===-1) {
            noteArray.push(note.pitch);
            keyboardPictureTopNote = Math.max(keyboardPictureTopNote, note.pitch);
            keyboardPictureBottomNote = Math.min(keyboardPictureBottomNote, note.pitch);
            if(getNoteColor(note.pitch)==="bl") {
                var lineY = getNoteCenterY(staffY, clefTopNote, note.pitch);
                var dashPen = new QPen(new QBrush(new QColor("black"), Qt.SolidPattern), 1, Qt.DashLine);
                scene.addLine(measureX + WHITE_KEY_WIDTH, lineY, chordX + 5, lineY, dashPen);
            }
        }
    }
    // Draws one long stem uniting notes in chord.
    // Uses measureY (staffY), clefTopNote, chord, chordX,
    var chordTopY = getNoteCenterY(staffY, clefTopNote, chord.topNote().pitch);
    var chordBottomY = getNoteCenterY(staffY, clefTopNote, chord.note(0).pitch);
    if(chord.notes > 1)
        drawChordLongStem(stemDirection, chordX, chordTopY, chordBottomY);

    drawLedgerLines(tickX, staffY, chordTopY, chordBottomY);
}


function drawKeyboard(clef, x, staffY, bottomNote, topNote, noteArray)
{
    if(clef===2)
        clef="G";

    var clefTopNote = getTopNoteFromClef(clef);

    if(getNoteColor(bottomNote)==="bl") bottomNote--;
    if(getNoteColor(topNote)==="bl") topNote++;

    for (var note = bottomNote; note <= topNote; note++) {
        if(getNoteColor(note)==="wh") {
            if(noteArray.indexOf(note)===-1)
                drawKey(clef, x, staffY, note, false);
            else
                drawKey(clef, x, staffY, note, true);
        }
    }

    // Draw black notes above white notes, to avoid lines crossing black pressed white squares.
    for (note = bottomNote; note <= topNote; note++) {
        if(getNoteColor(note)==="bl") {
            if(noteArray.indexOf(note)===-1)
                drawKey(clef, x, staffY, note, false);
            else
                drawKey(clef, x, staffY, note, true);
        }
    }

    // If needed, draw half of clipped black keys on the edges.
    // Bottom clipped black key:
    var y, clippingY;
    if(getNoteColor(bottomNote-1)==="bl") {
        y = getKeyY(staffY, clefTopNote, bottomNote-1);
        clippingY = getKeyY(staffY, clefTopNote, bottomNote)+WHITE_KEY_HEIGHT;
        scene.addRect(x,y,BLACK_KEY_WIDTH, clippingY - y, new QPen(), new QBrush(new QColor("black"), Qt.SolidPattern));
    }
    // Top clipped black key:
    if(getNoteColor(topNote+1)==="bl") {
        clippingY = getKeyY(staffY, clefTopNote, topNote);
        y = getKeyY(staffY, clefTopNote, topNote+1)+BLACK_KEY_HEIGHT;
        scene.addRect(x,clippingY,BLACK_KEY_WIDTH, y - clippingY, new QPen(), new QBrush(new QColor("black"), Qt.SolidPattern));
    }

    return WHITE_KEY_WIDTH;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 6.1
// Functions called by ....-> drawSingleStaff & drawDoubleStaff -> drawMeasure -> drawRest():
// getNoteDurationFromTickLength(also by drawNote)
//
//-------------------------------------------------------------------------------------------------------
function getNoteDurationFromTickLength(tickLength) {
    switch(tickLength) {
        case 1920: //whole note (semibreve)
            return new NoteDuration("whole", 0);
        case 1680: //double-dotted half note
            return new NoteDuration("half", 2);
        case 1440: //dotted half note
            return new NoteDuration("half", 1);
        case 1280: //triplet whole note (1/3 of breve)
            return new NoteDuration("whole", 3);
        case 960: //half note (minim)
            return new NoteDuration("half", 0);
        case 840: //double-dotted crochet
            return new NoteDuration("quarter", 2);
        case 720: //dotted crochet
            return new NoteDuration("quarter", 1);
        case 640: //triplet half note (1/3 of semibreve)
            return new NoteDuration("half", 3);
        case 480: //1/4 note (crochet)
            return new NoteDuration("quarter", 0);
        case 420: //double-dotted quaver
            return new NoteDuration("8th", 2);
        case 360: //dotted quaver
            return new NoteDuration("8th", 1);
        case 320: //triplet crochet (1/3 of minim)
            return new NoteDuration("quarter", 3);
        case 240: //1/8 note (quaver)
            return new NoteDuration("8th", 0);
        case 210: //double-dotted semiquaver
            return new NoteDuration("16th", 2);
        case 180: //dotted semiquaver
            return new NoteDuration("16th", 1);
        case 160: //triplet quaver (1/3 of crochet)
            return new NoteDuration("8th", 3);
        case 120: //1/16 note (semiquaver)
            return new NoteDuration("16th", 0);
        case 105: //double-dotted demi-semiquaver
            return new NoteDuration("32th", 2);
        case 90: //dotted demi-semiquaver
            return new NoteDuration("32th", 1);
        case 80: //triplet semiquaver (1/3 of quaver)
            return new NoteDuration("16th", 3);
        case 60: //1/32 note (demi-semiquaver)
            return new NoteDuration("32th", 0);
        case 45: //dotted semi-demi-semiquaver
            return new NoteDuration("64th", 1);
        case 40: //triplet demi-semiquaver (1/3 of semiquaver)
            return new NoteDuration("32th", 3);
        case 30: //1/64 note (semi-demi-semiquaver)
            return new NoteDuration("64th", 0);
        default:
            return new NoteDuration("", 0);
    }
}


function NoteDuration(durationName, durationModifier) {
    this.durationName = durationName;
    this.durationModifier = durationModifier; //0:nothing, 1:one dot, 2:two dots, 3:triplet.
}


//-------------------------------------------------------------------------------------------------------
//
// Section 6.2
// Functions called by ....-> drawSingleStaff & drawDoubleStaff -> drawMeasure -> getStemDirection():
// intervalInWhiteKeys(also by getNoteCenterY, noteIsInline)
//
//-------------------------------------------------------------------------------------------------------
function intervalInWhiteKeys(noteA, noteB){
    var interval = 0;
    if(noteB > noteA) {
        for(var note=noteA+1; note<=noteB; note++)
            if(getNoteColor(note)==="wh") interval++;
    }
    else {
        for(var note=noteA-1; note>=noteB; note--)
            if(getNoteColor(note)==="wh") interval--;
    }

    return interval;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 6.3
// Functions called by ....-> drawSingleStaff & drawDoubleStaff -> drawMeasure -> drawChord():
// getNoteColor(also by getNoteY, noteIsInline, intervalInWhiteKeys, getNoteCenterY, getKeyY, drawKeyboard, drawNote, drawKey),
// drawNote, getNoteCenterY(also by getKeyY, getNoteY), drawChordLongStem, drawLedgerLines
//
//-------------------------------------------------------------------------------------------------------
function drawNote(clefTopNote, noteX, staffY, midiNote, tickLength, stemDirection) {
    var noteDuration = getNoteDurationFromTickLength(tickLength);
    if(noteDuration.durationName === "")
        return;
    var color = getNoteColor(midiNote);
    var image;
    var noteY;
    if(noteDuration.durationName !== "whole") {
        image = pngImages.getImage(noteDuration.durationName + "_" + stemDirection + "_" + color + ".png");
        noteY = getNoteY(staffY, clefTopNote, midiNote, stemDirection);
    }
    else {
        image = pngImages.getImage("whole_" + color + ".png");
        noteY = getNoteY(staffY, clefTopNote, midiNote, "up");
    }

    var pixmapItem = scene.addPixmap(image);
    pixmapItem.setOffset(noteX, noteY.imageY);

    if(noteDuration.durationModifier !==0)
        drawDurationModifier(noteDuration.durationModifier, noteX, noteY.dotY, stemDirection);
}


function getNoteColor(midiNote){
    var blackNotes = [0,1,0,1,0,0,1,0,1,0,1,0];
    var color = blackNotes[midiNote%12];
    if(color === 1) return "bl";
    else return "wh";
}


function getNoteCenterY(staffY, clefTopNote, midiNote) {
    var diatonicInterval = intervalInWhiteKeys(clefTopNote, midiNote);
    var y = staffY - (diatonicInterval * 2 * NOTE_DISTANCE);
    if(getNoteColor(midiNote)==="bl") {
        // The y given above lies in a white key before the black key.
        if(clefTopNote > midiNote) y+= NOTE_DISTANCE;
        else y-= NOTE_DISTANCE;
    }
    return y;
}


function drawChordLongStem(stemDirection, chordX, chordTopY, chordBottomY) {
    var qPen = new QPen(new QBrush(new QColor("black"), Qt.SolidPattern), 2);
    if(stemDirection==="up") {
        scene.addLine(chordX + 21, chordTopY-10, chordX + 21, chordBottomY-10, qPen);
    }
    else
        scene.addLine(chordX+1, chordTopY+10, chordX+1, chordBottomY+10, qPen);
}


function drawLedgerLines(tickX, staffY, chordTopY, chordBottomY) {
    var linePen = new QPen(new QBrush(new QColor("black"), Qt.SolidPattern), LINE_WIDTH);
    for(var y=staffY; y>chordTopY-SPACE_BETWEEN/2; y-=SPACE_BETWEEN+LINE_WIDTH) {
        scene.addLine(tickX-2, y, tickX+25, y, linePen);
    }

    for(y=staffY+STAFF_HEIGHT-LINE_WIDTH; y<chordBottomY+SPACE_BETWEEN/2; y+=SPACE_BETWEEN+LINE_WIDTH) {
        scene.addLine(tickX-2, y, tickX+25, y, linePen);
    }
}


//-------------------------------------------------------------------------------------------------------
//
// Section 6.4
// Functions called by ....-> drawSingleStaff & drawDoubleStaff -> drawMeasure -> drawKeyboard():
// getTopNoteFromClef(shown under drawMeasure), getNoteColor(shown under drawChord), drawKey, getKeyY(also by drawKey)
//-------------------------------------------------------------------------------------------------------
function getKeyY(staffY, clefTopNote, note){
    var y;
    if(getNoteColor(note)==="wh") {
        y = getNoteCenterY(staffY, clefTopNote, note)-WHITE_KEY_HEIGHT/2;
    }
    else {
        y = getNoteCenterY(staffY, clefTopNote, note)-BLACK_KEY_HEIGHT/2;
        // Lowers key if it is a F#
        if(note%12===6) y++;
        // Raises key if it is a D# or A#
        else if(note%12===3 || note%12===10) y--;
    }
    return y;
}


function drawKey(clef, x, staffY, note, isPressed) {
    var clefTopNote = getTopNoteFromClef(clef);
    var y;
    var whitePen = new QPen(QColor.fromRgb(244, 238, 217));
    var blackBrush = new QBrush(new QColor("black"), Qt.SolidPattern);
    var whiteBrush = new QBrush(QColor.fromRgb(244, 238, 217), Qt.SolidPattern);

    var pressedSize = BLACK_KEY_HEIGHT - 2;

    if(getNoteColor(note)==="wh") {
        y = getKeyY(staffY, clefTopNote, note);
        scene.addRect(x,y,WHITE_KEY_WIDTH-1, WHITE_KEY_HEIGHT);
        if(isPressed===true) {
            var whitePressedX = x+WHITE_KEY_WIDTH - 4 - pressedSize;
            scene.addEllipse(whitePressedX, y+2, pressedSize, pressedSize, new QPen(), blackBrush);
        }
    }
    else {
        y = getKeyY(staffY, clefTopNote, note);
        scene.addRect(x,y,BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, new QPen(), blackBrush);
        if(isPressed===true) {
            var blackPressedX = x + BLACK_KEY_WIDTH - 2 - pressedSize;
            scene.addEllipse(blackPressedX, y+1, pressedSize, pressedSize, whitePen, whiteBrush);
        }
    }
}


//-------------------------------------------------------------------------------------------------------
//
// Section 7
// Functions called by ....-> drawMeasure -> drawChord -> drawNote():
// getNoteColor(shown under drawChord), getNoteDurationFromTickLength(shown under drawRest),
// drawDurationModifier, getNoteY
//
//-------------------------------------------------------------------------------------------------------
function drawDurationModifier(durationModifier, noteX, modifierY, stemDirection) {
    var blackBrush = new QBrush(new QColor("black"), Qt.SolidPattern);
    switch(durationModifier) {
        case 1:
            scene.addEllipse(noteX + 25, modifierY, 3, 3, new QPen(), blackBrush);
        break;
        case 2:
            scene.addEllipse(noteX + 25, modifierY, 3, 3, new QPen(), blackBrush);
            scene.addEllipse(noteX + 30, modifierY, 3, 3, new QPen(), blackBrush);
        break;
        case 3:
            textItem = scene.addText("3", new QFont("Times New Roman", 14, -1, true));
            if(stemDirection==="up") {
                noteX += 12;
                modifierY -= 110;
            }
            else if(stemDirection==="down"){
                noteX -= 8;
                modifierY += 80;
            }
            else if(stemDirection==="rest"){
                noteX -= 8;
                modifierY += 80;
            }

            textItem.pos = new QPointF(noteX, modifierY);
        break;
    }
}


function getNoteY(staffY, clefTopNote, midiNote, stemDirection) {
    var noteY = new NoteY();
    noteY.centerY = getNoteCenterY(staffY, clefTopNote, midiNote);
    if(getNoteColor(midiNote)==="bl") {
        noteY.dotY = noteY.centerY - 1;
        // Make black notes cross the staff line more clearly.
        if(noteIsInline(staffY, clefTopNote, midiNote+1)===false) noteY.centerY+= 2;
        else if(noteIsInline(staffY, clefTopNote, midiNote-1)===false) noteY.centerY-= 1;
    }
    else {
        if(noteIsInline(staffY, clefTopNote, midiNote)===true)
            noteY.dotY = noteY.centerY - 6;
        else
            noteY.dotY = noteY.centerY;
    }
    if(stemDirection==="down") noteY.imageY = noteY.centerY-41;
    else noteY.imageY = noteY.centerY - 89;
    return noteY;
}


//-------------------------------------------------------------------------------------------------------
//
// Section 8
// Functions called by ....-> drawMeasure -> drawChord -> drawNote -> getNoteY():
// NoteY, getNoteCenterY(shown under drawChord), getNoteColor(shown under drawChord), noteIsInline
//
//-------------------------------------------------------------------------------------------------------
function NoteY() {
    this.imageY = 0;
    this.centerY = 0;
    this.dotY = 0;
}


function noteIsInline(staffY, clefTopNote, midiNote){
    if(getNoteColor(midiNote)==="bl") return false;
    if(intervalInWhiteKeys(clefTopNote, midiNote)%2 === 0) return true;
    else return false;
}
