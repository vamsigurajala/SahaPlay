// Places to sit. Each seat is a spot in a room (measured from the room's back-left
// corner, like the furniture itself); tapping it walks your avatar there. If someone is
// already sitting, avatarSpacing puts you right beside them.

export const SEATS = [
  // ground floor
  ['hall', 11.6, 10.4], ['hall', 14.0, 10.4], ['hall', 11.6, 14.6], ['hall', 14.0, 14.6],
  ['study', 3.0, 13.0], ['study', 4.8, 14.4],
  ['gameroom', 17.0, 10.8], ['gameroom', 1.8, 14.6],
  ['terrace', 4.0, 1.5], ['terrace', 5.0, 1.5],
  ['market', 5.2, 12.3], ['market', 6.8, 12.3], ['market', 13.2, 12.3], ['market', 14.8, 12.3],
  // upstairs
  ['f2hall', 7.9, 10.4], ['f2hall', 10.1, 10.4], ['f2hall', 5.3, 6.6], ['f2hall', 5.3, 8.2], ['f2hall', 13.0, 7.4],
  ['f2breakup', 12.9, 2.1], ['f2breakup', 14.7, 2.1], ['f2breakup', 14.6, 8.0], ['f2breakup', 13.8, 10.7],
  ['f2balcony', 12.4, 4.0], ['f2balcony', 14.8, 4.0],
  ['f2bed1', 2.6, 12.8], ['f2bed2', 3.2, 10.4],
].map(([zone, x, z], i) => ({ id: `${zone}-${i}`, zone, x, z }));

export const seatsIn = (zone) => SEATS.filter(s => s.zone === zone);
