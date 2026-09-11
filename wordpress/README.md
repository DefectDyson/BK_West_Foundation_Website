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

## Stoppen

```sh
docker compose --env-file /tmp/bk-wordpress-preview/local.env -f wordpress/compose.yml stop
```

Die lokale Datenbank bleibt dabei erhalten. `/tmp` kann bei einem Neustart
geleert werden; die lokale Zugangsdaten-Datei bei Bedarf zuvor geschützt
sichern. Beim Verlust dieser Datei nicht mit neuen Passwörtern dieselbe
Datenbank weiterverwenden.
