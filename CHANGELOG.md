# File Simulator Changelog

## V0.2.9
### Date: 1/31/2019

#### Changes:
- Camera zooming with trackpad pinching is now supported.
- Input now handles `WheelEvent` from the browser.
  - `getWheelMoved()` - Returns true when wheel movemented detected.
  - `getWheelData()` - Return wheel event data for the current frame.

## V0.2.8
### Date: 1/31/2019

#### Changes:
- Disabled double-tap to zoom functionality that is added by iOS and Android by default.
- Fixed an issue where files would all appear in the same spot upon first load of a session.
- Added the Session ID to the top header.
- After logging in, the user will now be redirected back to the session they first tried accessing.
- Fixed some typos.

## V0.2.7
### Date: 1/30/2019

#### Changes:
- Added `line.to` and `line.color` tags. `line.to` creates an arrow that points from the source file to the target file. An array of files is also supported.
- Added formula support for `label`, `label.color`.
- Added some functions to `FileCalculations` to help with handling of short file ids:
  - `getShortId` - Return the short id for the file.
  - `fileFromShortId` - Find file that matches the short id.
  - `filesFromShortIds` - Find files that match the short ids.
- Disabled depth buffer writing for the new SDF rendered font.
- Running `updateMatrixWorld` function for `FileMesh` when its position is updated.
  - This allows child objects to have accurate world positioning the moment its parent is moved instead of waiting for ThreeJS to run the next render update frame.

## V0.2.6
### Date: 1/28/2019

#### Changes:
- Improved the game window to resize the renderer and camera automatically
- Improved how the files window scales for small devices
- Move the toolbar into a floating action button
- Closing the info box now shows an icon in its place that can be used to reopen it
- Selecting/changing files no longer re-opens the info box
- Tags that the user adds to the info box are no longer automatically hidden

## V0.2.5
### Date: 1/28/2019

#### Changes:
- Rotation with touch input now spins in the correct direction.
- 3D text rendering is now done with SDF (Signed Distance Field). This gives us a much cleaner and crisper text representation.
- Added `label.color` tag that allows you to change the color of the label text.


## V0.2.4
### Date: 1/28/2019
In this version we improved workspaces and made other minor quality of life improvements.

#### Changes:
- Added the ability to change hex heights
- Added the ability to stack cubes on top of each other
- Added the ability to drag single hex tiles onto other workspaces
- Added a `list()` formula function that is able to calculate which files are stacked on top of each other.
- Made the square grid tiles visible only if they are over a related hex tile
- Made hexes have a short height by default
- Made hexes larger by default
- Made cubes always attach to a workspace
- Made only the grid that a cube is being dragged onto visible


##V0.2.1
###Date: 1/22/2019
In this version we added support for multiple simultaneous sessions. When logging in users can optionally provide a “Session ID” that will put them into that session. Alternatively, they can type the Session ID into the URL and go there directly. Sharing URLs to share your session is also supported.

#### Changes:
- Multi-Session Support
  - Users enter in a Session ID to go to a sandbox all their own.
  - They can also share the URL with other people to be put directly into that session.
- Hexes no longer have bevels.
- In Formulas, hashtag expressions which have only a single result now return that result directly instead of in an array.
  - For example, If there was only one file with a #sum set to “10” and there was a formula “=#sum”
    - In v0.2.0 the formula would equal “[10]”
    - In v0.2.1 the formula would equal “10”


## V0.2.0
### Date: 1/16/2019
In this version we added support for offline mode and made general improvements to the user interface.

#### Changes:
- Added offline mode
  - After loading the app over HTTPS, the user will be able to go completely offline (airplane mode) and still be able to access everything. This means:
    - The app should load
    - The user should be able to create new files and workspaces
    - They should be able to edit tags and perform actions.
  - When new app versions are available, the user will be prompted to refresh the page to use the new version.
When the user goes back online the app will attempt to sync with the server. If successful, then everyone else will be able to see their changes because they have been synced.
  - If syncing is not successful, then this is because of one or more merge conflicts between the user’s version and the server’s version.
    - Merge conflicts happen when two users edit the same tag to different values.
    - The computer doesn’t know which is the most valid so it has to ask the user.
  - When merge conflicts happen a notification will pop up and prompt the user to fix them.
    - This prompt will also be in the side bar underneath the hamburger menu.
  - Until the user fixes the merge conflicts any changes they make will not be synced to the server.
  - When the user fixes the merge conflicts, their state is synced to the server and everyone is able to see it.
  - The sidebar will show the current online/offline synced/not synced status. Right clicking it will give the option to force the app into offline mode for testing and vice versa.
- Added a nuke button
  - This button allows the user to delete everything in the website.
  - This is only for testing so don’t expect it to work in all cases. In particular, don’t expect it to work super well when there are multiple people on the site at a time.
- Removed test buttons from the sidebar
- Changed the version number to be based on the latest annotated git tag. This will let us have full control over the version numbers while making them a lot more human readable. Upon hover it will also show the git commit hash that the build was made from.