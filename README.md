# BrainBoom X2 - Multi-page adventure

Seven connected screens: Home, Create, Creature, Play, Speak, Grow, and Player Profile. Play has three staged learning chapters: Grammar Garden, Sentence Studio, and the final Story Chapter. Players complete each lesson and need at least 80% on its checkpoint to unlock the next. Progress and player name save in this browser. A character-guide placeholder sits beside every learning activity.

The Player Profile shows learning progress and a collection of created creature icons. New icons are saved automatically after generation. The Part 2 card system, creature name/ability/personality fields, PNG + JSON save, browser persistence, images, schema and original Vercel API are retained.

## Deploy to the existing GitHub/Vercel repository
1. Extract this ZIP.
2. Copy the contents inside BrainBoom-X2-Part2 into the root of the existing repository; do not nest the outer folder.
3. Commit and push to the same GitHub repository connected to Vercel.
4. Confirm STABILITY_API_KEY remains configured in Vercel. The existing backend URL remains in script.js as BACKEND.

Image generation requires the deployed API and configured key. Use the deployed site or a local web server; direct file opening may not support API requests.
