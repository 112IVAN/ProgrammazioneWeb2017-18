var jwt = require('jsonwebtoken')

const SECRET = "Ciao"

const genera = () => {
  token = jwt.sign({}, SECRET, {
    expiresIn: '10h'
  });

  var b = new Buffer(token);
  return b.toString('base64');
}

const verifica = (req) => {

  if (!req.headers.authorization) {
    return "Fornire token Bearer"
  }

  const s = req.headers.authorization.split(' ')

  if (!/^Bearer$/i.test(s[0])) {
    return "Token Bearer formulato male"
  }

  try {

    var b = new Buffer(s[1], 'base64');
    var token_decodebase64 = b.toString();

    jwt.verify(token_decodebase64, SECRET);

    return true

  } catch (err) {
    if (err.name == "TokenExpiredError") {
      return "Token scaduto"
    } else {
      return "Token non valido (errore generico)"
    }
  }
}

module.exports = {
  verifica,
  genera
}