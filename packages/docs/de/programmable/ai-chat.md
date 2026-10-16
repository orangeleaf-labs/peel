---
title: AI-Chat
description: Integrierter AI-Assistent mit mehr als 90 Werkzeugen zum Erstellen und Bearbeiten von Designs.
---

# AI-Chat

<kbd>⌘</kbd><kbd>J</kbd> beziehungsweise <kbd>Strg</kbd><kbd>J</kbd> öffnet den Assistenten. Eine Anweisung kann Formen erstellen, Stile ändern, die Anordnung konfigurieren, Komponenten bearbeiten oder das Dokument analysieren.

## Einrichtung

Beim ersten Start fragt die geführte Einrichtung, wobei die KI helfen soll und was bereits vorhanden ist: ein Anthropic-API-Schlüssel. Sie verbindet diesen Zugang und weist ihn den Rollen **Design agent** und **Vision** zu; manuell Eingerichtetes bleibt erhalten. Sie lässt sich überspringen und jederzeit über **Einstellungen → KI und Agenten → Geführte Einrichtung starten** erneut ausführen. Modelle manuell einrichten:

1. AI-Chat öffnen.
2. Einstellungssymbol wählen.
3. Modell hinzufügen und Anbieter, Modellkennung, Zugangsdaten und Fähigkeiten konfigurieren.
4. Modell speichern und der Rolle **Design agent** zuweisen.

Mehrere Modelle können getrennt für Gestaltung, Prüfung, schnelle Aufgaben und Bildeingaben verwendet werden. Modelle derselben Anbieterverbindung verwenden dieselben sicher gespeicherten Zugangsdaten.

### Anbieter

Peel nutzt ausschließlich die Anthropic-API. Den API-Schlüssel gibt es unter [console.anthropic.com](https://console.anthropic.com); das Claude-Modell wird aus der mitgelieferten Liste gewählt, sodass für die Modellauswahl kein anderer Dienst kontaktiert wird. Anfragen gehen direkt an `api.anthropic.com`; eine eigene Basisadresse gibt es nicht. In der Desktop-App liegt der Schlüssel im Anmeldedatenspeicher des Betriebssystems.

## Werkzeuge

Der Assistent verfügt über mehr als 90 Werkzeuge für Erstellung, Gestaltung, Anordnung, Komponenten, Variablen, Suche, Prüfung, Analyse, Export und Vektorbearbeitung.

## Visuelle Prüfung

Nach Änderungen kann der Assistent das Ergebnis mit `export_image` rendern und mit der Anfrage vergleichen. Dadurch werden Anordnungsfehler, fehlende Elemente und abweichende Farben sichtbar. `diff_visual`, standardmäßig aktiviert, vergleicht ein bearbeitetes Objekt mit einer Referenzkopie und liefert die geänderten Pixel und den betroffenen Bereich, sodass der Assistent prüfen kann, ob eine Änderung auf ihr Ziel beschränkt blieb.

## Hinweise

- Vor der Anfrage die betreffenden Objekte auswählen; der Assistent kennt die aktuelle Auswahl.
- Farben, Größen und Positionen möglichst genau angeben.
- Eine Nachricht kann mehrere Objekte ändern.
- Während eine Antwort läuft, können Sie andere Seiten ansehen: Der Assistent arbeitet auf der Seite weiter, auf der die Nachricht begonnen hat, und seine Vorschauen erscheinen, sobald Sie zurückkehren. Solange Sie woanders sind, nennt der Chat die Seite, an der gearbeitet wird, mit **Zur Seite**, um dorthin zurückzukehren. Wechselt der Assistent selbst die Seite, folgt Ihre Ansicht.
- Änderungen durch AI können rückgängig gemacht werden.
- Nach jedem Werkzeugaufruf wird die Anordnung neu berechnet.
