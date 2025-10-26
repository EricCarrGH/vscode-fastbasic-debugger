## 0.1.0 - 2023-5-5
* Initial bring up

## 0.4.0 - 2023-5-31
* Fixed Mac download bugs

## 0.5.0 - 2023-6-1
* Fixed edge case with 0 non-array variables

## 0.6.1 - 2023-6-7
* Add limited step/step into functinality (to step over a procedure call)

## 0.6.2 - 2023-6-13
* Fixed representation of signed numbers (words)

## 0.7.0 - 2025-7-12
* Bug Fix: Support tab after DATA statements
* Bug Fix: Wait longer for compiling long programs before erroring out
* Feature: Enabled CustomEmulator for Mac, allowing starting Altirra in wine
* Feature: Added WindowsPath setting to keep windows paths for Altirra/Wine use

## 0.8.0
* Bug Fix: Fix issue where Atari800MacX would not start if multiple copies on disk
* Supports latest Atari800MacX 6.1 w/ FujiNet
* Tighter Atari800MacX integration - start/stop stays in sync
* (TODO) Now compiles source file in place, in case it references other files in same directory

## 0.8.1
* Starts Atari800MacX using command line args instead of forcing a custom config
* Emulators: Downloads Altirra 4.31 and Atari800MacX 6.1.0 if no emulator is present

