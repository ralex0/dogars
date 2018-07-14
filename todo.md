Todos/Ideas
===========

- Make dogars-chan follow invites
- Make dogars-chan check dubs/trips/quads
- Make hijacker play random moves/run an AI (There isn't a single decent AI for pokémon)
    - A decent AI should:
        - **always** take less than 25 seconds to make a move
        - know if a move won't be effective because of an ability 
        - know if an ability may counter its ability
        - not assume that the opponent plays optimally
    - A good AI should:
        - be a decent AI
        - Determine if a pokemon is illusioned based on it legal moveset and used moves
        - battle preview, avoid using super effective moves that can be resisted by dark types until all illusion mons are determined
        - understand that local maximum is determined by the next two turns
        - understand when and why use a status move (hazard/status/support/weather/room/boost/debuff/volatile)
        - understand when and why use a move with a status effect (instead of using a normal stab move to chip damage, a suicide lead could use scald to brn a phys attacker even if they resist water, to give a setup sweeper better chance of success)
        - understand the difference between opponent predicting a move and opponent being a drooling retard
        - understand the level of prediction its opponent is capable of, and adjust accordingly
    - A great AI should:
        - be a good AI
        - Understand what kind of threats its team can handle and how easily
        - how to handle an immediate threat (my set is a full special attacker and the opponent switched to chansey)
        - how to handle an indirect threat (my set is a slow special attacker that is checked by his fast sweeper that can't switch in safely because it can't bulk a   special attack, but if I KO his currently active mon, he will get a chance to safely switch in)
        - be able to efficiently make use of any set (snips, good goy, toge, boom boom, eggulai...) (requires giving RNG a higher importance)
        - be able to make guesses about its opponents set based on previous behavior. (He could counter me if his set had this specific thing, but he hasn't used this set so his set doesn't counter me)
        - Give RNG a bigger importance in decisions if desperate

Any AI doesn't have to play perfectly all the time, just to not stroke at critical times. A bad move due to a missed predict is ok, but not 3 times in a row.
Getting a switch predicted is OK, but switching out a +4 def/spdef snips in front of a burnt lando that doesn't have SD is not.

Realistically implementing the "great" AI could take a few weeks if the codebase for Showdown was more modular and allowed an easier and more efficient state serialization/duplication of a battle. Unfortunately, as the code is right now, it'd take a significant rewrite.

Also, don't try to implement a """"General"""" AI. These are all slow inaccurate garbage hacks. Machine Learning and AI101 shit (minimax variants and shallow neural nets) won't produce anything of worth and are a waste of resources.
Hardcoding behaviors is fine and is the most efficient solution (read: faster) as long as we can prove we have a 100% accurate understanding of the meta game and what constitutes an optimal play for any given turn for a player.

Simplify deploying:
 - Right now deploying relies on both frontend and backend to be stored in the same folder:
    - Only the backend should know where is the front-end
 - Symlinks needs to be manually created from the backend public folder to the frontend dist folder:
    - Needs to be done once but needs to be automated
    - the precache symlink needs to be recreated on every rebuild of the frontend because it's build-unique; needs to be automated


BUGS
====

Backend:
- Basically the only backend bug left is the disconnection problem that occurs every few days:
    - Doesn't seem to be solvable as not even the closed event fires, so no way to detect when it happens unless by polling
    - I wonder if this bug actually still exists or if I'm just crazy

Frontend:
- Frontend seems to require an explicit refresh to load new versions, closing and reopening doesn't seem to be enough.
- Mobile version is better but still ugly:
    - Switch to Bulma?:
        - I don't want to rewrite fucking CSS
        - Frameworks don't seem to like what I did with the search bar
        - Size isn't an issue as the whole frontend is still under 100k gziped 
