
// [ Del 382929736 ] Yuuko Amamiya

const app = {
  client_id: 6413012, // change this
  api_v: '5.73',
  scope: ['wall', 'photos', 'offline']
}

const page = {
  albums: [{
    tag: 'A',
    id: 252419921
  }, {
    tag: 'M',
    id: 252446240
  }],
  for_users: [ '86382408', '360805297', '45209697', '99216093', '76272443' ]
}

// group_id, album_id
const clubs = new Map ([
  [ 124684770, 252566518 ],
  [ 118107058, 253301166 ]
])