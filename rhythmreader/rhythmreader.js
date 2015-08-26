//---------------------------------------------------------
//    init
//    this function will be called on startup of mscore
//---------------------------------------------------------
function close() {

}

function init()
      {
      // print("test script init");
      }

//-------------------------------------------------------------------
//    run
//    this function will be called when activating the
//    plugin menu entry
//
//    global Variables:
//    pluginPath - contains the plugin path; file separator is "/"
//-------------------------------------------------------------------

var form;
var outFile;
var reqId;
var defaultOpenDir = QDir.homePath();
var http;
var numNotesClicked = 0;
var currentDate;
var currentTime;
var oldBeatTime;
var oldBeatDate;
var noteLengths=[];
var noteValues = [];
var timeSignature = new TimeSig(4, 4);
var ticksPerMeasure = 480*4;


var beatsGiven =0;
var averageBeat=0;

function run()
      {
      var loader = new QUiLoader(null);
              var file   = new QFile(pluginPath + "/rhythmreader.ui");
              file.open(QIODevice.OpenMode(QIODevice.ReadOnly, QIODevice.Text));
              form = loader.load(file, null);
              form.buttonBox.accepted.connect(accept);
              form.notesButton.clicked.connect(noteClicked);
              form.doneButton.clicked.connect(doneClicked);
              form.beatButton.clicked.connect(beatClicked);
              form.beatDoneButton.clicked.connect(beatDoneClicked);
              form.resetButton.clicked.connect(resetClicked);
              form.TimeSignatureComboBox.setCurrentIndex(0);
              form.TimeSignatureComboBox["currentIndexChanged(int)"].connect(setTimeSignature);

        //      form.pushButtonName.setFocusPolicy();
              form.exec();
      }

function resetClicked(){
  numNotesClicked = 0;
  currentDate;
  currentTime;
  oldBeatTime;
  oldBeatDate;
  noteLengths=[];
  noteValues = [];
  timeSignature = new TimeSig(4, 4);
  ticksPerMeasure = 480*4;
  beatsGiven =0;
  averageBeat=0;
  form.mainLabel.setText("");
}

function noteClicked()
  {
    if (numNotesClicked == 0){
      oldDate = new Date();
      oldTime = oldDate.getTime();
    }
    else{
      currentDate = new Date();
      currentTime = currentDate.getTime();
      form.mainLabel.setText(currentTime-oldTime);
      setNoteLengths(currentTime-oldTime);
      oldDate=currentDate;
      oldTime=currentTime;
    }
    
    numNotesClicked++;
    }

function doneClicked(){
  var possibleNoteValues = [.5, 1, 1.5, 2, 3, 4];
  for (var i=0; i < noteLengths.length; i++) {
    var frac = noteLengths[i]/averageBeat;
    var minDiff = 100;
    var minDiffArg = 0.25;
    for (var j=0; j<possibleNoteValues.length; j++){
      if (Math.abs(possibleNoteValues[j]-frac) < minDiff){
        minDiff = Math.abs(possibleNoteValues[j]-frac);
        minDiffArg = possibleNoteValues[j];
      }
    }
    noteValues.push(minDiffArg);
    form.mainLabel.setText(noteValues);

  }

}

function beatClicked(){
    if (beatsGiven==0){
      oldBeatDate = new Date();
      oldBeatTime = oldBeatDate.getTime();
    }
    else{
      var currentBeatDate = new Date();
      var currentBeatTime = currentBeatDate.getTime();
      averageBeat = (averageBeat*beatsGiven+currentBeatTime - oldBeatTime)/(beatsGiven+1);
      form.mainLabel.setText(currentBeatTime - oldBeatTime);
      oldBeatTime=currentBeatTime;
      oldBeatDate=currentBeatDate;
    }
    beatsGiven++;
    form.mainLabel.setText(averageBeat);
}

function beatDoneClicked(){
  form.mainLabel.setText("There are " + averageBeat + " ms between beats, \n and " + 60000/averageBeat + " beats per minute");
}

function setNoteLengths(noteLength){
  noteLengths.push(noteLength);
}


function accept()
{
  var score   = new Score();
  score.name  = "Score name";
  score.title = "Score title";
  score.appendPart();
  score.keysig = curScore.keysig;
  score.appendMeasures(200);
  score.timesig = timeSignature;
  var cursor = new Cursor(score);
  cursor.goToSelectionStart();
  cursor.staff = 0;
  cursor.voice = 0;
  cursor.rewind();

/*  var chord = new Chord();
  var newnote = new Note();
  newnote.pitch = 69;
  chord.tickLen = 480*3;
  chord.addNote(newnote);
  cursor.add(chord);
  cursor.next();

  var chord = new Chord();
  var newnote = new Note();
  newnote.pitch = 69;
  newnote.tied = 1;
  chord.tickLen = 480;
  chord.addNote(newnote);
  newnote.tied = 1;
  cursor.add(chord);
  newnote.tied = 1;
  cursor.next();
  newnote.tied = 1;


  var chord = new Chord();
  var newnote = new Note();
  newnote.pitch = 69;
  newnote.tied = 2;
  chord.tickLen = 480;
  chord.addNote(newnote);
  newnote.tied = 2;

  cursor.add(chord);
  newnote.tied = 2;

  cursor.next();
  newnote.tied = 2;*/


  for (var i=0; i<noteValues.length; i++){
    newTickLenLeft = noteValues[i]*480;
    var tieds = 0;
    while (newTickLenLeft > 0){
      var chord = new Chord();
      var newnote = new Note();
      newnote.pitch = 69;
      chord.tickLen = Math.min(newTickLenLeft,ticksPerMeasure-cursor.tick()% ticksPerMeasure);
      newTickLenLeft = newTickLenLeft - chord.tickLen;
       if (newTickLenLeft > 0 && tieds>0){
         //not first note, there's more notes left -> tied to next and previous note
         newnote.tie = 3;
       }
       else if(newTickLenLeft>0 && tieds==0){
         //first note, tied to next
         newnote.tie = 2;
         newnote.noteHead = 3;

       }
       else if(newTickLenLeft==0 && tieds>0){
         //not first note, last note in group -> tied to previous note
         newnote.tie = 1;
         newnote.noteHead = 3;

       }
       else{
        newnote.tie = 0;
       }
      chord.addNote(newnote);
      cursor.add(chord);
      cursor.next();
      tieds = tieds +1;
    }
  }

  score.title = noteValues;
}

function setTimeSignature(index){
  if (index==0){
    timeSignature = new TimeSig(4, 4);
    ticksPerMeasure = 480*4;
  }
  if (index==1){
    timeSignature = new TimeSig(3, 4);
    ticksPerMeasure = 480*3;
  }
  if (index==2){
    timeSignature = new TimeSig(2, 2);
    ticksPerMeasure = 480*4;

  }
  if (index==3){
    timeSignature = new TimeSig(6, 8);
    ticksPerMeasure = 240*6;

  }
}

var mscorePlugin = {
      menu: 'Plugins.rhythmreader',
      init: init,
      run:  run,
      onClose: close
      };

mscorePlugin;

