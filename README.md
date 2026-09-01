# BK West United Foundation — Website

Ausgelieferter Stand der Website der BK West United Foundation Germany e.V.,
veröffentlicht über GitHub Pages.

Dieses Repo enthält nur das fertige Ergebnis — die sechs Seiten mit ihren
Bildern, Schriften und Stylesheets. Gepflegt wird die Website in einem
getrennten Arbeits-Repo; dort liegen Vorlagen, Rohmaterial und die Build-Skripte.

## Vorschau, nicht Produktivstand

Solange die Seite unter bkwestunited.de noch nicht live ist, tragen alle Seiten
`<meta name="robots" content="noindex, nofollow">`, und `robots.txt` sperrt das
gesamte Verzeichnis. So taucht die Vorschau nicht in Suchmaschinen auf und
konkurriert später nicht mit der eigentlichen Domain.

Vor dem echten Start beides entfernen.

## Aktualisieren

Im Arbeits-Repo den Auslieferungsordner neu bauen und den Inhalt hierher
übernehmen:

    python3 veroeffentlichen.py
    cp -a veroeffentlichen/. ../BK_West_Foundation_Website/

Danach hier committen und pushen:

    git add -A
    git commit -m "Website aktualisiert"
    git push

`.nojekyll` sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert,
statt sie durch Jekyll zu schicken.

Achtung: `veroeffentlichen.py` erzeugt kein `robots.txt` und kein `noindex` —
beides ist hier von Hand ergänzt und muss nach einem Neubau wieder hinein,
solange die Vorschau nicht öffentlich sichtbar sein soll.
