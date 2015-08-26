//=============================================================================
//  MuseScore
//  Linux Music Score Editor
//  $Id:$
//
/******************************************************************************
  	Create a harmonic or melodic scale from a natural minor scale.

		minorvariations.js
		Version: 01.01

		Requires: minorvariations.ui

		If no selection is made then the whole of the score is assumed.
		(Only one voice is processed.)
		The actions are selected from a window:
			The minor key can be changed from that detected.
			Conversions can be:
				Natural to harmonic (raise the 7th).
				Natural to melodic (raise the 6th and 7th when notes ascending).
				Harmonic to natural (lower the 7th).
				Melodic to natural (lower the 6th and 7th when notes ascending).
			The notes affected can be changed to red or black. The colour
			can be changed with or without changing the notes pitch.
		If processing for melodic, the cursor is set for repetitions as these
		can change the note sequence.
		All notes in all chords of the selection are accessed in turn and any ascending
		sequence detected (from the first note in each chord).
		Only notes in the first voice are processed.
		For harmonic (from natural) any note 10 semitones above the key tonic
		is coloured and/or raised 1 semitone.  
		For harmonic removal (to natural) any note 11 semitones above the key tonic
		is coloured and/or lowered 1 semitone.
		For melodic (from or to natural) to detect an ascending sequence each note
		must be	compared with the previous note. This can mean that the previous note
		is the first in the sequence but wasn't processed as such. When this is the case
		and the previous note is subject to change/colouring, the cursor is reset to
		the beginning of the selection and moved until the previous note is reached so
		that it can now be processed. (There doesn't seem to be a way of positioning
		the cursor to a specified tick other than progressing through from the beginning.)
		For melodic (from natural) in an ascending sequence, any note 8 or 10 semitones
		above the key tonic is coloured and/or raised 1 semitone.
		For melodic removal (to natural) in an ascending sequence, any note 9 or 11
		semitones above the key tonic is coloured and/or lowered 1 semitone.
		
		History:
			February, 2012		01.01 First release

  	Author: John H. Everington
*********************************************************************************/
//  This program is free software; you can redistribute it and/or modify
//  it under the terms of the GNU General Public License version 2.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program; if not, write to the Free Software
//  Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
//=============================================================================
//    This is ECMAScript code (ECMA-262 aka "Java Script")
//=============================================================================

var globalTitle = "Minor Variations";			// Not used - there in case message to be output
var globalKeySig;			// Key signature as -7 (Cb/ab) to +7 (C#/a#)
var globalFirstMeasure;		// Number of first measure selected
var globalLastMeasure;		// Number of last measure selected
var globalEndTick;			// End of selection
var globalStaffFirst;		// First staff selected
var globalStaffLast;		// Last staff selected
var globalSelectionMade;	// true if selection made
var globalChange;			// Change: 0 - harmonic, 1 - melodic, 2 - un-harmonic or 3 - un-melodic
var globalAction;			// Action: 0 no change (red), 1 no change (black), 2 change (red), 3 change (black)

function init() {
// This function is run at the start up of MuseScore.
};

function run() {
// This function is run when the plugin is selected.
	globalKeySig = curScore.keysig;
	globalAction = 0;	// Default of mark as red (no change)
// Verify selection
	var c = new Cursor(curScore);
	c.voice = 0;		// Only one voice
	mySelectedMeasureNumbers(c);
	c.goToSelectionEnd();
	globalEndTick = c.tick();		// If no selection, this will go to end of score
	globalStaffLast = c.staff - 1;
	c.goToSelectionStart();
	if (c.eos()) {
		// If no selection, start at beginning of score
		c.rewind();
		globalSelectionMade = false;
		globalStaffFirst = 0;
		globalStaffLast = curScore.staves - 1;
	}
	else {
		globalSelectionMade = true;
		globalStaffFirst = c.staff;
	}
// Load main form
	formMain = loadForm(pluginPath, "minorvariations.ui");
	// Score and selection details
	if (curScore.title.length != 0) {
		myQColouredText(formMain.textTitle, "376f00", curScore.title, true);
	}
	else {myQColouredText(formMain.textTitle, "376f00", "Untitled", true);}
	if (globalSelectionMade) {formMain.textNoSel.setText("Selected");}
	else {formMain.textNoSel.setText("No selection!");}
	if (globalStaffFirst == globalStaffLast) {
		formMain.textStaves.setText("Staff "+globalStaffFirst);
	}
	else {
		formMain.textStaves.setText("Staves "+globalStaffFirst+" to "+globalStaffLast);
	}
	if (globalFirstMeasure == globalLastMeasure) {
		formMain.textMeasures.setText("Measure "+globalFirstMeasure);
	}
	else {
		formMain.textMeasures.setText("Measures "+globalFirstMeasure+" to "+globalLastMeasure);
	}
	// Key
	formMain.comboKey.setCurrentIndex(14 - (globalKeySig + 7));	// Select combo box item (from zero)
	formMain.comboKey["currentIndexChanged(int)"].connect(keyChanged);
	// Choice of action
	formMain.comboAction.setCurrentIndex(0);	// Select combo box item (from zero)
	formMain.comboAction["currentIndexChanged(int)"].connect(actionChanged);
	// OK
	formMain.buttonBox.accepted.connect(minorOK);	// Connect the OK Button function
	// Show form
	formMain.show();
	return;
};

function keyChanged(myKey) {
// Combobox key changed: set global key signature as -7 (g#) to +7 (a#)
//	myKey	Key signature as 0 (a#), .... 7 (a), ..... 14 (g#)
	globalKeySig = (14 - myKey) - 7;
	return;
};

function actionChanged(myAction) {
// Combobox action changed
//	myAction	 0 no change (red), 1 no change (black), 2 change (red), 3 change (black)
	globalAction = myAction;
	return;
};

function minorOK() {
// OK button pressed on main form - so apply chord changes
	var myStaff;		// Current staff
	var myPrevNote;		// Pitch of the previous note (melodic test)
	var myGoingUp;		// 0 if not going up, else going up the scale
	var myPrevTick;		// Tick of the previous chord - i.e. the one before
	var myGetNext;		// true if next chord wanted
	var myChangeMe;		// true if note is subject to change or colour
	
	if (formMain.radioHarmonic.checked) {globalChange = 0;}		// Harmonic
	if (formMain.radioMelodic.checked) {globalChange = 1;}		// Melodic
	if (formMain.radioRemHarmonic.checked) {globalChange = 2;}	// Remove Harmonic
	if (formMain.radioRemMelodic.checked) {globalChange = 3;}	// Remove Melodic
// Go through each note in selection
	if (globalChange == 1 || globalChange == 3) {
		// Need to follow repetitions for ascending sequence in melodic
		var c = new Cursor(curScore, true);
	}
	else {var c = new Cursor(curScore);}
	curScore.startUndo();
	for (myStaff = globalStaffFirst; myStaff <= globalStaffLast; ++myStaff) {
		// For each staff
		goStaffBeginning(c, myStaff);	// Reset to beginning of selection
		myPrevNote = 999;
		myGoingUp = 0;
		myPrevTick = 0;
		while (c.tick() < globalEndTick) {
			myGetNext = true;
			if (c.isChord()) { 
				// For each chord within a staff (voice 0 only)
				var chord = c.chord();
				var n = chord.notes;
				for (var i = 0; i < n; i++) {
					var note = chord.note(i);
					if (i == 0) {
						// Root note only, used to see if going up scale (melodic test)
						if (note.pitch > myPrevNote) {
							// Going up
							if (myGoingUp == 0 && myPrevTick > 0) {
								// First, so note before this is also in the ascending sequence
								var y = myHalfNotePosition(myPrevNote, globalKeySig, true);
								// See if it is to change i.e. 6th or 7th starting the sequence
								if ((globalChange == 1 && (y == 8 || y == 10)) ||
									(globalChange == 3 && (y == 9 || y == 11))) {
									// The note needs changing
									goStaffBeginning(c, myStaff);	// Reset to beginning
									myPrevNote = -1;
									while (c.tick() < myPrevTick) {c.next();}	// Find previous
									myPrevTick = 0;
									i = 999;			// Force exit from note loop
									myGetNext = false;	// Dont get next chord
									continue;
								}
							}
							myGoingUp++;
						}
						else {myGoingUp = 0;}	// Not going up
						myPrevNote = note.pitch;
						myPrevTick = c.tick();
					}
					// Does this note need changing?
					var x = myHalfNotePosition(note.pitch, globalKeySig, true);
					myChangeMe = false;
					if (globalChange == 0 && x == 10) {myChangeMe = true;}	// Increase harmonic 7th
					if (globalChange == 1 && myGoingUp > 0) {
						// Melodic and going up
						if (x == 8 || x == 10) {myChangeMe = true;}	// Increase melodic 6th ot 7th
					}
					if (globalChange == 2 && x == 11) {myChangeMe = true;}	// Reduce harmonic 7th
					if (globalChange == 3 && myGoingUp > 0) {
						// Melodic and going up
						if (x == 9 || x == 11) {myChangeMe = true;}	// Reduce melodic 6th ot 7th
					}
					if (myChangeMe) {
						// Note subject to change
						mySetColour(note, globalAction);	// Set colour red or black
						if (globalAction > 1) {
							// Make change
							if (globalChange < 2) {note.pitch++;}	// Increase
							else {note.pitch--;}					// Return to original
						}
					}
				}
			}
			else {
				// Reset previous note and tick when a rest met
				myPrevNote = 999;
				myPrevTick = 0;
			}	
			if (myGetNext) {c.next();}
		}
	}
	curScore.endUndo();	
	formProc.close();
	return;
};

function loadForm(myPath, myFormName) {
// Returns a form after opening and loading it
//	myPath		Path to form e.g. pluginPath
//	myFormName	Name and extension of form e.g. "name.iu"
	var loader = new QUiLoader(null);
	var file = new QFile(myPath + "/"+myFormName);
	file.open(QIODevice.OpenMode(QIODevice.ReadOnly, QIODevice.Text));
	return loader.load(file, null);
};

function myQColouredText(myTextObject, myCol, myText, myBold) {
// Add coloured text to form object (QLabel)
//	myTextObject	Object e.g. globalformMain.textOne
//	myColour		Colour as 6 didgit hexadecimal text string
//					e.g. "00007f" Dark blue, "0000ff" Blue, "376f00" Dark Green
//	myText			Text
//	myBold			true if colour to be bold
	var myString1a = "<span style= \"color:#";
	var myString1b = "<span style= \"font-weight:600; color:#";
	var myString2 = "\">";
	var myString3 = "</span>";
	if (myBold) {
		myTextObject.setText(myString1b+myCol+myString2+myText+myString3);
		return;
	}
	myTextObject.setText(myString1a+myCol+myString2+myText+myString3);
	return;
};

function myHalfNotePosition(myPitch, myKeySig, myMinor) {
// Returns the half note position in the key (0 is the root/tonic, 2 supertonic, etc )
//	myPitch is the MIDI pitch of the note
//	myKeySig is the key signature as -7 (Cb/g#) to +7 (C#/bb)
//  myMinor is true if the key is minor (else major)
    //          Cb Gb  Db G# D#  A# F  C  G  D  A  E   B  F# C#
	//          g# d#  a# f  c   g  d  a  e  b  f# c# ab  eb bb
	var key = [11, 6,  1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1];
	var n = myPitch % 12;		// 0 is C, 1 is C# .... 11 is B
	var r = key[myKeySig + 7];	// ditto
	if (myMinor) {
		if (r < 3) {r += 9;}
		else {r -= 3;}
	}
	if (n < r) {n += 12;}
	return (n - r);
};

function goStaffBeginning(myCursor, myStaff) {
// Set cursor to the beginning
//	myCursor	Cursor
//	myStaff		Staff number
	if (globalSelectionMade) {myCursor.goToSelectionStart();}
	else {myCursor.rewind();}
	myCursor.voice = 0;		// Only one voice is processed
	myCursor.staff = myStaff;
	return;
};

function mySetColour(myNote, myAction) {
// Set the colour of a note
//	myNote		Note
//	myAction	0 or 2 red, other black
	var colRed = new QColor(255, 0, 0);
	var colBlack = new QColor(0, 0, 0);
	
	if (myAction == 0 || myAction == 2) {myNote.color = new QColor(colRed);}
	else {myNote.color = new QColor(colBlack);}
	return;
}

var mscorePlugin = {
// Defines were the function will be placed in the MuseScore menu structure
      menu: 'Plugins.Minor Variations',
      init: init,
      run:  run
};

mscorePlugin;