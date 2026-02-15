# Downtime Planner for Blades in the Dark

*Downtime Planner for Blades in the Dark* is a FoundryVTT module used to speed up the choices and decisions made during the downtime part of play. 

## Features

- **Downtime Options**: Your players can use this module to select their activities during downtime, and post their options to the chat!
- **Rules References**: Ditch the book! Most of the downtime rules are readily-accessible inside of the module.
- **Chat Integration**: Post your downtime activities to the chat to share with the rest of the crew.

## Installation

1. In Foundry VTT, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Paste the manifest URL: `https://github.com/q-johnson/downtimeplanner-bitd/releases/latest/download/module.json`
4. Click "Install"

## Usage

### via Actor/Character Sheet
There is a new tab at the top of Character windows. Clicking on this will open up the **Downtime Planner** window.

### via Macro
Create a new Macro, select the`script` type, then enter the following in the command box:
`game.downtimePlanner.open();`

## Development

This module uses [FoundryVTT V13 API](https://foundryvtt.com/api/) and `ApplicationV2` for the user interface.

## License

[LICENSE.txt](LICENSE.txt)

This work is based on Blades in the Dark (found at http://www.bladesinthedark.com/), product of One Seven Design, developed and authored by John Harper, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).

## Support

Report issues on GitHub: `https://github.com/q-johnson/downtimeplanner-bitd/issues`

## Disclaimer - Use of Generative AI

Generative AI was used in order to create an initial CSS file found in the `/styles/` directory. Truth be told, I am bad at making anything look pretty, so I had generative AI take a shot at it, then I made adjustments until I was happy with the final product.