/* The anatomy of every two-fact choice on the storefront (a day, a time, a
   multi-day event's day): a fixed-height tile with both lines centred, the
   main fact first (14px / 600) and the detail under it (13px / 400, muted).
   Equal heights and one inner padding mean a row of tiles reads as a set.
   The selected tile is drawn by ChoiceCard (2px accent edge + tint); the main
   line takes the accent text colour on top of that. The lines carry their own
   text-center: ChoiceCard's base text-left otherwise wins over the tile's. */
export const TILE = "flex h-16 flex-col items-center justify-center gap-0.5 px-tight py-0 text-center";
export const TILE_MAIN = "block w-full whitespace-nowrap text-center text-base font-semibold leading-5";
export const TILE_SUB = "block w-full whitespace-nowrap text-center text-sm font-normal leading-5 text-muted";
