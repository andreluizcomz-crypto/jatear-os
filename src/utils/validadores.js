export function somenteDigitos(valor) {
  return (valor || '').replace(/\D/g, '');
}

// Validação de CNPJ com dígito verificador
export function validarCnpj(cnpj) {
  const digitos = somenteDigitos(cnpj);
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    let peso = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso;
      peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    calcularDigito(digitos.slice(0, 12)) === Number(digitos[12]) &&
    calcularDigito(digitos.slice(0, 13)) === Number(digitos[13])
  );
}
