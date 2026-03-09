/**
 * Сбор заявок из всех источников
 * Унифицирует данные в единый формат
 */

/**
 * Парсинг заявки с сайта (Tilda формат — калькулятор count_main)
 */
function parseSiteForm(body) {
    return {
        source: 'site',
        client_name: body.Name || body.name || null,
        client_phone: body.Phone || body.phone || null,
        client_email: body.Email || body.email || null,
        form_data: {
            type: body['Дом_квартира_или_офис'] || body['На_каком_объекте_планируете_монтаж'] || null,
            area: body['Общая_площадь_м2'] || body['Площадь_объекта'] || null,
            kitchen: body.kitchen || null,
            livingroom: body.livingroom || null,
            ceiling: body.potolok || null,
            floors: body['Количество_этажей_шт'] || null,
            bathrooms: body['Количество_санузлов_шт'] || null,
            bedrooms: body['Количество_спален_шт'] || null,
        },
        utm_source: body.utm_source || body['UTM source'] || null,
        utm_campaign: body.utm_campaign || body['UTM campaign'] || null,
    };
}

/**
 * Парсинг заявки с квиза /02
 */
function parseQuiz1Form(body) {
    return {
        source: 'quiz2',
        client_name: body.Name || body.name || null,
        client_phone: body.Phone || body.phone || null,
        client_email: body.Email || body.email || null,
        form_data: {
            object: body['На_каком_объекте_планируете_монтаж'] || null,
            area: body['Площадь_объекта'] || null,
            systems: body['Какие_системы_хотите_сделать'] || null,
        },
        utm_source: body.utm_source || body['UTM source'] || null,
        utm_campaign: body.utm_campaign || body['UTM campaign'] || null,
    };
}

/**
 * Парсинг заявки с квиза /5questions
 */
function parseQuiz2Form(body) {
    return {
        source: 'quiz1',
        client_name: body.Name || body.name || null,
        client_phone: body.Phone || body.phone || null,
        client_email: body.Email || body.email || null,
        form_data: {
            room_type: body['Для_какого_помещения_нужна_вентиляция'] || null,
            area: body['Укажите_общую_площадь_помещения'] || null,
            concern: body['Что_вас_беспокоит_больше_всего'] || null,
            priority: body['Что_для_вас_важно'] || null,
            timeline: body['Когда_планируете_решить_вопрос_с_вентиляцией'] || null,
        },
        utm_source: body.utm_source || body['UTM source'] || null,
        utm_campaign: body.utm_campaign || body['UTM campaign'] || null,
    };
}

/**
 * Парсинг заявки с попапа скидки
 */
function parsePopupForm(body) {
    return {
        source: 'site',
        client_name: body.Name || body.name || null,
        client_phone: body.Phone || body.phone || null,
        client_email: null,
        form_data: {},
        utm_source: body.utm_source || null,
        utm_campaign: body.utm_campaign || null,
    };
}

/**
 * Автоопределение типа формы по полям
 */
function autoDetectAndParse(body) {
    // Квиз /5questions — есть поле про помещение
    if (body['Для_какого_помещения_нужна_вентиляция'] || body['Что_вас_беспокоит_больше_всего']) {
        return parseQuiz2Form(body);
    }

    // Квиз /02 — есть поле про объект монтажа
    if (body['На_каком_объекте_планируете_монтаж'] && body['Какие_системы_хотите_сделать']) {
        return parseQuiz1Form(body);
    }

    // Калькулятор — есть площадь и кухня
    if (body['Общая_площадь_м2'] || body.kitchen || body.potolok) {
        return parseSiteForm(body);
    }

    // Попап или простая форма — только имя и телефон
    return parsePopupForm(body);
}

module.exports = {
    parseSiteForm,
    parseQuiz1Form,
    parseQuiz2Form,
    parsePopupForm,
    autoDetectAndParse,
};
