# Prüfung der veröffentlichten Website am 12.09.2026

Geprüft wurde https://bkwestunited.de/ mit installiertem Theme 0.2.0.
Die nachfolgende Korrektur 0.2.1 ist lokal gebaut und getestet, aber zum
Zeitpunkt dieses Berichts noch nicht auf der Domain installiert.

## Erfolgreich geprüft

- Alle sechs Hauptseiten liefern HTTP 200 und die vorgesehenen Theme-Inhalte.
- 14 unterschiedliche interne Links einschließlich Sprungmarken funktionieren.
- 45 lokale Ressourcen einschließlich Bilder, Stylesheets und Schriften liefern HTTP 200.
- 18 Browser-Prüfungen: sechs Hauptseiten bei 1440, 768 und 390 Pixeln.
- 90 Bedienprüfungen erfolgreich: Einwilligungsdialog, Einstellungen erneut
  öffnen, mobiles Menü, Schließen mit Escape und Aktuell-Panel, soweit vorhanden.
- Keine JavaScript-Laufzeitfehler, fehlgeschlagenen HTTP-Antworten oder defekten
  Bilder in diesen Browser-Prüfungen. Zahlungs- und Videoanbieter wurden blockiert;
  tatsächliche Zahlungen, Mitgliedsanträge und Video-Wiedergabe wurden nicht getestet.
- Unbekannte Adresse liefert korrekt HTTP 404.
- Hauptseiten sind nicht mit noindex gesperrt; robots.txt und Sitemap erreichbar.

## Spendenstand

Die öffentliche Route `/wp-json/bkw/v1/bus-project` liefert HTTP 200 und
`Cache-Control: no-store, max-age=0`. Die Daten stimmen mit der Betterplace-API
für Projekt 184020 überein:

| Angabe | Geprüfter Wert |
| --- | --- |
| Gespendet | 3.125 € |
| Ziel | 8.000 € |
| Offen | 4.875 € |
| Finanziert | 39 % |
| Bestätigte Spenden | 49 |
| Status | Spendenaktion läuft |

Im Aktuell-Panel der vier relevanten Seiten und auf dem Startseitenbalken
kommen diese Daten korrekt an. Die zusätzliche Bus-Karte im Inhalt der
Projekte-Seite zeigte dagegen noch 2.440 € und 30 %. Die Selektoren für diese
Karte fehlten im Aktualisierungsskript.

Theme 0.2.1 ergänzt Betrag, Prozentwert, Balken, Spendenziel, Restbetrag,
Spendenanzahl, Zeitangabe und Status für diese Karte. Der Skript-Versionsparameter
ist ebenfalls erhöht, damit Browser das aktualisierte Skript abrufen.
`check-bus-project.mjs` prüft die Karte zusätzlich auf Desktop und Mobilgerät,
einschließlich Centbeträgen, pausierten/beendeten/finanzierten Projekten und Ausfällen.
Dieser Test sowie die ZIP-Integritätsprüfung sind bestanden.

Zum Installieren `wordpress/build/bk-west-foundation.zip` erneut als Theme
hochladen und die installierte Version ersetzen. Seitenzuordnungen bleiben bestehen.

## Weitere offene Punkte

1. `/datenschutz/` enthält sichtbare Platzhalter für drei Anbieteranschriften
   und Hostingangaben sowie einen Hinweis auf den Entwurfsstand.
2. WordPress.com-/Jetpack-Statistikskript und Zählpixel werden bereits ohne
   eine Auswahl im Einwilligungsdialog geladen. Der Dialog steuert diese
   Statistikaufrufe derzeit nicht. Dies ist eine technische Beobachtung;
   eine rechtliche Bewertung war nicht Bestandteil der Prüfung.
3. Die alten öffentlichen Seiten `/mitglied/`, `/aktive-mitgliedschaft/`,
   `/lastschriftmandat/`, `/spenden/` und `/privacy-policy/` zeigen überwiegend
   nur ihre Überschrift und einen Link zur Startseite. Sie sind nicht Teil
   der neuen Hauptnavigation, bleiben aber direkt erreichbar. Die alte
   `/mitgliedsantrag/`-Seite enthält noch ein Formular und wurde nicht abgesendet.
4. Auf `/mitgliedschaft/` entsteht bei 768 Pixeln Fensterbreite ein kleiner
   horizontaler Überlauf: 764 Pixel Inhaltsbreite bei 753 Pixel verfügbarer
   Breite. Ursache ist die rechte `.panel`-Box im Hauptinhalt. Das Problem
   war bereits im statischen Ausgangsstand dokumentiert. Bei 1440 und 390
   Pixeln sowie auf den übrigen Hauptseiten trat es nicht auf.

Messwerte und Rohdaten dieser Prüfung liegen lokal unter `/tmp/bkw-live-check/`.
Keine WordPress-Einstellungen, bestehenden Seiteninhalte oder Plugins wurden
im Rahmen dieser Prüfung geändert.
