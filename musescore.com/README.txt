/---------------------------------------------------------/
/                                                         /
/    Publish plugin for MuseScore. Version 0.9.6-0.7 	  /
/							                                            /		
/---------------------------------------------------------/

This plugin enables uploading of mscz files generated by MuseScore to MuseScore.com.

The configuration is stored in 
<user home>/.musescore/plugins/musescore/
On Windows
C:\Documents and Settings\<USERNAME>\.musescore\plugins\musescore


Install
-------------
Just copy paste "musescore_publish" directory to MuseScore plugin directory.
It required root/admin access.

Plugins directory on windows is at 
C:\Program Files\MuseScore 0.9\plugins

On Mac, use the install_mac.command. It works only if MuseScore is installed in Applications. You just need to double click the file and provide your admin password.


Uninstall
---------
Delete "musescore_publish"
Don't forget to remove settings.txt from
<user home>/.musescore/plugins/musescore/

Warning
-------
Not tested on Linux yet.


What's new?
-----------
- Work with 0.9.6 beta2
- Authentication on api.musescore.com only
- Title, subtitle, tags metadata
- UTF-8 is supported in metadata
- Choose a licence

What next?
----------
- More metadata
- Ability to list your sheets
- Ability to open a sheet from the list
- Ability to overwrite/update an existing sheet

Translations
-----------
lupdate musescore.com.js  ui\authorize_dialog.ui ui\musescore_dialog.ui ui\musescore_progress.ui ui\start_browser_dialog.ui -ts translations\locale_fr.ts
lupdate musescore.com.js  ui\authorize_dialog.ui ui\musescore_dialog.ui ui\musescore_progress.ui ui\start_browser_dialog.ui -ts translations\locale_es.ts
lupdate musescore.com.js  ui\authorize_dialog.ui ui\musescore_dialog.ui ui\musescore_progress.ui ui\start_browser_dialog.ui -ts translations\locale_de.ts

lrelease locale_fr.ts -qm locale_fr.qm
lrelease locale_es.ts -qm locale_es.qm
lrelease locale_de.ts -qm locale_de.qm
