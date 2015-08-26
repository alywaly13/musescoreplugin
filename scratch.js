//=============================================================================
//  HalfTime plugin
//
//  This plugin created by underquark July 2012
//  It is a shamelessly modified version of a plugin created by lasconic called "Retrograde"


function init()
{
}

function run()
{
  var score   = new Score();
  score.name  = "Score name";
  score.title = "Score title";
  score.appendPart();
  score.keysig = curScore.keysig;
  score.appendMeasures(200);
  var cursor = new Cursor(score);
  cursor.goToSelectionStart();
  cursor.staff = 0;
  cursor.voice = 0;
  cursor.rewind();

  var chord     = new Chord();
  chord.tickLen = 120;
  var newnote      = new Note();
  newnote.pitch    = 69;
  chord.addNote(newnote);
  cursor.add(chord);
  cursor.next();


  var chord     = new Chord();
  chord.tickLen = 480;
  cursor.add(chord);
  cursor.next();
  var newnote      = new Note();
  newnote.pitch    = 74;
  chord.addNote(newnote);
}

var mscorePlugin =
{
      menu: 'Plugins.HalfTime',
      init: init,
      run:  run
}

mscorePlugin;
