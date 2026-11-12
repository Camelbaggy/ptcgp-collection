# Synchro Drive : quantités sans perte (lot B1, constat D2)

## Problème

La synchro fusionne chaque table « dernier écrit gagne » (LWW) par ligne. Pour `owned`, la ligne est une
**quantité absolue**. Deux appareils hors ligne qui ajoutent chacun un pack contenant la carte `x`
(1 → 2 de chaque côté) produisent deux lignes `x = 2` ; la fusion en garde une, donc `x = 2` au lieu de 3,
alors que l'historique fusionné contient bien les deux évènements.

## Principe

L'historique est l'union des évènements des deux côtés ; c'est lui qui dit ce qui s'est passé. Pour chaque
carte, on part de la ligne `owned` gagnante (LWW, inchangé) puis on la **rebase** sur l'historique fusionné :
on applique les évènements que le côté gagnant ne connaissait pas, et on retire ceux qu'il connaissait mais
qui ont été annulés ailleurs.

Notations, pour une carte `x` :

- `W` : ligne `owned` gagnante (une marque de suppression vaut 0) ;
- `Ew` : évènements vivants (non annulés) du côté qui a fourni `W` ;
- `Em` : évènements vivants de l'historique fusionné ;
- `δ(e)` : variation de `x` causée par `e` (`eventDeltas`, la même fonction que pour la saisie et l'annulation).

Si aucun évènement de `Em \ Ew` ni de `Ew \ Em` ne touche `x`, rien ne change (comportement actuel).

### Corrections = valeur absolue datée

Une `correction` (Mise à jour, import Pokémon-Zone, vidéo, lecture d'écran) dit « à la date D, j'ai N
exemplaires ». Elle **absorbe** donc les évènements datés avant elle, quel que soit l'appareil qui les a
saisis : un pack ouvert sur le téléphone hors ligne puis un import PZ fait sur le PC ne doivent pas compter
le pack deux fois. Soit `c*` la correction la plus récente touchant `x` dans `Em` (départage par id) :

- **`c*` absente, ou connue du gagnant** : `q = W + Σ δ(e ∈ Em \ Ew) − Σ δ(e ∈ Ew \ Em)`, en ne gardant que
  les évènements datés après `c*` (ceux d'avant sont absorbés).
- **`c*` inconnue du gagnant** : `q = c*.to + Σ δ(e ∈ Em, daté après c*)`.

Les deux formules donnent le même résultat quand l'état de chaque appareil est cohérent avec son historique,
donc la fusion converge quel que soit l'ordre de synchro des appareils. `q` est borné à 0 ; à 0 la ligne
devient une marque de suppression. Une ligne recalculée reçoit un tampon neuf (`now`, appareil local) : elle
est écrite en local et téléversée, et l'autre appareil la reprendra telle quelle (il connaîtra alors tous les
évènements, donc plus d'ajustement).

### Ce qui reste « dernier écrit gagne »

- Les ajustements manuels de la fiche carte (`setOwned`, boutons +/−) ne créent pas d'évènement : en conflit
  hors ligne avec une autre modification de la même carte, l'un des deux reste perdu, comme avant.
- Une correction faite à partir de données en retard (page Pokémon-Zone pas encore à jour) absorbe à tort
  un pack plus ancien. L'écran de revue des imports signale déjà les baisses.
- Les dates viennent de l'horloge de chaque appareil.
- Un appareil resté hors ligne plus de 90 jours (purge des marques de suppression) peut faire revivre un
  évènement annulé, donc ses quantités.

## Déploiement

Au premier passage après la mise à jour, les deux appareils ont déjà le même historique (fusionné par les
synchros précédentes) : `Em = Ew`, aucun ajustement, rien n'est compté deux fois. Les pertes passées ne sont
pas réparées automatiquement : c'est le rôle de la vérification ci-dessous.

## Détection d'écart et réparation proposée

L'historique commence le 31/10/2025 alors que la collection vient de la sauvegarde du tableur : on ne peut
pas rejouer tout l'historique depuis 0. Mais une correction donne une valeur absolue datée. Pour chaque carte
qui en a une : `attendu = c*.to + Σ δ(évènements datés après c*)`. Si `owned ≠ attendu`, la carte est
signalée.

Réglages › Synchronisation › « Vérifier les quantités » liste ces cartes (quantité actuelle → attendue). Rien
n'est modifié sans clic : « Corriger » écrit une seule `correction` (annulable, et nouvelle référence pour la
carte). Un ajustement manuel fait depuis la fiche après la dernière correction apparaît aussi comme un écart :
le texte le dit, et chaque carte peut être décochée.

## Code

- `src/lib/sync/rebase.ts` (pur, testé) : `rebaseOwned` (fusion) et `checkOwnedConsistency` (vérification).
- `src/lib/sync/merge.ts` : `mergeSnapshots` fusionne l'historique, puis recalcule `owned` ; `MergeResult.rebased`
  liste les cartes recalculées.
- `src/features/sync/ConsistencyCheck.tsx` : vérification et réparation dans les Réglages.
