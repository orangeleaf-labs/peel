---
title: Czat AI
description: Wbudowany asystent z ponad 90 narzędziami do tworzenia i zmieniania projektów.
---

# Czat AI

Naciśnij <kbd>⌘</kbd><kbd>J</kbd> albo <kbd>Ctrl</kbd> + <kbd>J</kbd>. Asystent tworzy figury, zmienia style i układ, pracuje z komponentami oraz analizuje dokument.

## Konfiguracja

Przy pierwszym uruchomieniu konfiguracja z przewodnikiem pyta, w czym ma pomagać AI i z czego już korzystasz: z klucza API Anthropic. Łączy ten dostęp i przypisuje go do ról **Design agent** i **Vision**, nie zmieniając ręcznej konfiguracji. Możesz ją pominąć i uruchomić ponownie w **Ustawienia → AI i agenci → Uruchom konfigurację z przewodnikiem**. Aby skonfigurować modele ręcznie:

1. Otwórz panel czatu AI.
2. Kliknij ikonę ustawień.
3. Dodaj model i skonfiguruj dostawcę, identyfikator modelu, dane uwierzytelniające oraz możliwości.
4. Zapisz model i przypisz go do roli **Design agent**.

Możesz utworzyć kilka modeli i osobno przypisać je do projektowania, przeglądu, szybkich zadań oraz przetwarzania obrazów. Modele korzystające z tego samego połączenia dostawcy używają wspólnych zapisanych danych uwierzytelniających.

### Dostawcy

Peel korzysta wyłącznie z API Anthropic. Klucz API uzyskasz na [console.anthropic.com](https://console.anthropic.com), a model Claude wybierasz z wbudowanej listy, więc wybór modelu nie łączy się z żadną inną usługą. Żądania trafiają bezpośrednio do `api.anthropic.com`; nie ma własnego adresu bazowego. W aplikacji na komputer klucz jest przechowywany w magazynie poświadczeń systemu operacyjnego.

## Możliwości

Asystent korzysta z ponad 90 narzędzi do tworzenia, stylizowania, układu, komponentów, zmiennych, wyszukiwania, inspekcji, analizy, eksportu i operacji wektorowych. Do inspekcji należą `get_jsx` (widok JSX w obie strony), `diff_create` i `diff_jsx` (różnice strukturalne), `diff_visual` (różnice pikseli) oraz `describe` (rola semantyczna i wykrywanie problemów projektowych).

## Kontrola wizualna

Po utworzeniu lub zmianie projektu asystent może wywołać `export_image`, uzyskać obraz wyniku i porównać go z pierwotnym poleceniem. Pozwala to wykryć problemy z układem, brakujące elementy i nieprawidłowe kolory. Domyślnie włączone `diff_visual` porównuje zmieniony obiekt z kopią wzorcową i zwraca zmienione piksele oraz obszar, dzięki czemu asystent może sprawdzić, że zmiana nie wyszła poza cel.

## Wskazówki

- Przed wysłaniem polecenia zaznacz odpowiednie obiekty: asystent widzi zaznaczenie.
- Dokładnie podawaj kolory, rozmiary i położenie.
- Jedna wiadomość może zmienić kilka obiektów.
- Podczas odpowiedzi możesz przeglądać inne strony: asystent dalej pracuje na stronie, na której zaczęła się wiadomość, a jego podglądy pojawią się po powrocie. Gdy jesteś na innej stronie, czat pokazuje, nad którą pracuje asystent, i udostępnia przycisk **Przejdź do strony**. Jeśli asystent sam zmieni stronę, widok podąża za nim.
- Wszystkie zmiany AI można cofnąć.
- Po każdym wywołaniu narzędzia układ jest przeliczany automatycznie.
