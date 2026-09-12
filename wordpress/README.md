# Lokaler WordPress-Nachbau

Dieser Prüfstand übernimmt die **aktuell im Hauptverzeichnis liegenden sechs
HTML-Seiten**. Das ältere Build-Skript im Nachbarprojekt `../bk` wird nicht
verwendet. Die bestehende Website bei Strato wird weder angesprochen noch
verändert; es gibt hier kein Skript zur Veröffentlichung.

- HTML-Referenz: http://localhost:8765/
- WordPress-Vorschau: http://localhost:8766/
- Lokales WordPress-Backend: http://localhost:8766/wp-admin/

## Umfang und Grenzen

Die vorhandenen Texte, HTML-Strukturen, CSS-Regeln, Bilder und Skripte werden
übernommen. Der Generator ändert lokale Seitenlinks in WordPress-Links und
Asset-Pfade in Theme-Pfade und ergänzt die WordPress-Hooks. Die sechs Seiten
werden über zugewiesene WordPress-Seitenvorlagen ausgegeben. Unbekannte URLs
werden nicht auf die Startseite umgebogen.

**Die Inhalte liegen in dieser ersten Fassung fest in den Vorlagen.** Sie sind
noch keine einzeln bearbeitbaren WordPress-Blöcke. Diese Fassung dient dem
Nachweis, dass die aktuelle Optik und Bedienung unter WordPress funktionieren.

Die Testinstallation verwendet die in `compose.yml` per Digest festgelegten
offiziellen Images (WordPress 7.1 mit PHP 8.3, MariaDB 11.4). Die Konfiguration,
Datenbank und Plugins der bestehenden Strato-Installation wurden nicht kopiert.
Ein bestandener lokaler Vergleich ersetzt daher keinen späteren Test mit den
konkreten Plugins und Einstellungen der bestehenden Installation.

RaiseNow- und Video-Tests prüfen Ziel-URLs, Parameter, neuen Tab und Einwilligung.
Externe Dienste werden im Testbrowser blockiert. Es werden keine Zahlungen,
Mitgliedschaften oder E-Mails ausgelöst. Die eigentliche Zahlungsabwicklung
und Video-Wiedergabe sind nicht Bestandteil dieses lokalen Tests.

## Starten

Alle Befehle im Hauptverzeichnis des Projekts ausführen. Erfordert Docker mit
Compose, Python 3 mit Pillow und für den Browser-Vergleich Node.js und Chrome.

```sh
python3 wordpress/scripts/build_theme.py
python3 wordpress/scripts/prepare-local.py
docker compose --env-file /tmp/bk-wordpress-preview/local.env -f wordpress/compose.yml up -d
docker compose --env-file /tmp/bk-wordpress-preview/local.env -f wordpress/compose.yml exec -T --user www-data wordpress php /opt/bk-setup-local.php
```

Bei der ersten Einrichtung warten, bis WordPress seine Dateien nach
`/var/www/html` kopiert hat. Das Setup ist wiederholbar und verweigert den Lauf
außerhalb der lokalen Umgebung mit `WP_HOME=http://localhost:8766`.

Der Datenbank-Port ist nicht veröffentlicht. Der Webserver bindet nur an
`127.0.0.1:8766`. WordPress-HTTP-Aufrufe nach außen, automatische Updates und
WP-Cron sind für diesen Prüfstand deaktiviert. Suchmaschinenindexierung bleibt
gesperrt. Das Theme selbst erzwingt diese lokalen Einstellungen nicht.

Zugangsdaten werden getrennt unter `/tmp/bk-wordpress-preview/local.env`
mit Dateirechten `0600` erzeugt. Sie gehören ausschließlich zur Testumgebung.
Der lokale Benutzer heißt `bk-preview`; sein Passwort ist der Wert von
`BK_PREVIEW_ADMIN_PASSWORD` in dieser Datei. Keine echten Zugangsdaten in diesen
Ordner oder in die HTML-Dateien eintragen.

## Vergleichen

HTML-Referenz und Chrome starten, falls noch nicht aktiv:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

In einem weiteren Terminal:

```sh
google-chrome --headless=new --no-first-run --no-default-browser-check --disable-background-networking --remote-debugging-port=9223 --user-data-dir=/tmp/bk-wordpress-test-chrome about:blank
```

Dann:

```sh
node wordpress/scripts/check-preview.mjs
python3 wordpress/scripts/verify-preview.py
```

Der Browser-Test vergleicht alle sechs Seiten bei 1440, 1024, 768, 390 und
320 Pixeln Fensterbreite, mit identischen Browser-Einstellungen und geladenen
Schriften/Bildern. Für die statischen Vergleichsbilder werden Animationen
angehalten; Einblendeeffekte werden durch tatsächliches Scrollen ausgelöst.
Zusätzlich werden Menüs, Einwilligung, Spenden- und Aktuell-Panel geprüft.
Ergebnisse, Messwerte und Screenshots landen in
`/tmp/bk-wordpress-preview/check/`. Der zweite Schritt vergleicht die Pixel,
prüft interne Links und Assets sowie die unveränderten Ausgangsdateien.

Der Prüfbericht mit Schieberegler für den Screenshot-Vergleich lässt sich
anschließend separat öffnen:

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory /tmp/bk-wordpress-preview/check
```

Dann http://localhost:8767/ aufrufen. Ausschließlich den Unterordner `check`
bereitstellen, damit die daneben abgelegten lokalen Zugangsdaten privat bleiben.

Nach Änderungen an den HTML-Seiten erneut `build_theme.py` ausführen. Das Theme
ist im lokalen Container eingebunden. Die ZIP-Datei unter
`wordpress/build/bk-west-foundation.zip` ist ein **Prüfstand**, keine Freigabe
zum Aktivieren auf der bestehenden Website.

## Automatischer Spendenstand (Theme 0.2.1)

WordPress ruft die öffentliche Betterplace-API für Projekt **184020** auf.
Die Anzeige übernimmt Betrag, Gesamtziel (gespendet plus offen), Restbetrag,
bestätigte Spendenanzahl, Prozentsatz und Projektstatus. Sie erscheint im
Aktuell-Panel, auf dem Spendenbalken der Startseite und in der Bus-Karte auf
der Projekte-Seite. Version 0.2.1 ergänzt die zuvor fehlende Bus-Karte.

Der erste Seitenaufruf lädt die Daten über `/wp-json/bkw/v1/bus-project`.
Erfolgreiche Abrufe werden serverseitig 15 Minuten gespeichert. Bei sichtbarer
Seite fragt der Browser ungefähr alle 15 Minuten erneut an; nach der Rückkehr
zu einem alten Tab wird ebenfalls aktualisiert. Ohne Besucher sind keine
regelmäßigen Abrufe nötig. Der Browser verbindet sich dabei nur mit WordPress;
Betterplace wird vom Server aufgerufen, ohne Zugangsdaten oder Besucherdaten.

Bei Ausfällen bleibt der letzte erfolgreiche Stand einschließlich Abrufzeit
erhalten und erhält einen Hinweis. Ohne erfolgreichen Abruf bleibt der klar
datierte Stand aus der HTML-Vorlage sichtbar. Wiederholungsversuche sind auf
einmal pro Minute begrenzt. Geschlossene oder gesperrte Projekte zeigen einen
Link zur Projektinformation statt einer Spendenaufforderung. „Spendenziel
erreicht“ wird vom Status „Spendenaktion beendet“ unterschieden.

Die API-Route darf nicht durch ein Cache-Plugin oder CDN zwischengespeichert
werden. Der Endpoint sendet dafür `Cache-Control: no-store`. Die lokale
Testinstallation blockiert externe HTTP-Anfragen weiterhin; der folgende Test
verwendet simulierte Betterplace-Antworten und sendet keine externen Anfragen:

```sh
python3 wordpress/scripts/build_theme.py
docker compose --env-file /tmp/bk-wordpress-preview/local.env -f wordpress/compose.yml exec -T --user www-data wordpress php < wordpress/scripts/check-bus-project.php
node wordpress/scripts/check-bus-project.mjs
```

Für den Browser-Test muss Chrome wie oben mit Port 9223 laufen. Er prüft die
vier Seiten mit Aktuell-Panel auf Desktop und Mobilgerät, Centbeträge,
0/100-Prozent-Animation, Projektstatus und Ausfälle mit simulierten Antworten.
Der bestehende Pixelvergleich sperrt dieses zusätzliche Skript gezielt, damit
er weiterhin den statischen Ausgangsstand vergleicht.

**Installation des Updates:** `wordpress/build/bk-west-foundation.zip` unter
Design → Themes → Theme hinzufügen → Theme hochladen auswählen und die
installierte Version durch die hochgeladene Version ersetzen. Die bereits
angelegten Seiten und ihre Vorlagenzuordnungen bleiben dabei bestehen.
Das Anwendungspasswort kann Theme-Dateien über die normale WordPress-REST-API
nicht ersetzen. Nach dem Upload auf der öffentlichen Website den Spendenstand
und `/wp-json/bkw/v1/bus-project` prüfen.

## Stoppen

```sh
docker compose --env-file /tmp/bk-wordpress-preview/local.env -f wordpress/compose.yml stop
```

Die lokale Datenbank bleibt dabei erhalten. `/tmp` kann bei einem Neustart
geleert werden; die lokale Zugangsdaten-Datei bei Bedarf zuvor geschützt
sichern. Beim Verlust dieser Datei nicht mit neuen Passwörtern dieselbe
Datenbank weiterverwenden.
