function formatRut(input) {
    let rut = input.value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (rut.length > 1) {
        let dv = rut.slice(-1);
        let body = rut.slice(0, -1);

        let formattedBody = '';
        for (let i = body.length - 1; i >= 0; i--) {
            formattedBody = body[i] + formattedBody;
            if ((body.length - i) % 3 === 0 && i !== 0) {
                formattedBody = '.' + formattedBody;
            }
        }

        input.value = formattedBody + '-' + dv;
    } else {
        input.value = rut;
    }
}

function formatRutString(rutString) {
    if (!rutString) return '';
    const rutLimpio = rutString.replace(/[^0-9kK]/g, '').toUpperCase();
    if (rutLimpio.length < 2) return rutLimpio;

    const dv = rutLimpio.slice(-1);
    let body = rutLimpio.slice(0, -1);

    body = new Intl.NumberFormat('de-DE').format(body);

    return `${body}-${dv}`;
}