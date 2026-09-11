/*
    Entry date: the day the messages were sent, put into the site's date box.
    The site defaults that box to today, which files the tickets under the
    wrong draw when the messages are entered the day after.
*/
const ENTRY_DATE_FIELD_ID = 'entryDate';

// A WhatsApp export header: Android "09/09/26, 7:15 pm - Name:" or iOS
// "[09/09/26, 7:15:02 PM] Name:", 12- or 24-hour. The sender's colon is
// required, so system lines ("Messages and calls are end-to-end encrypted")
// and dates typed inside a message are not read.
const MESSAGE_DATE_REGEX = /^\[?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*(?:\]\s*[-~]?|[-~])\s*[^:]+:/i;

const padDatePart = value => String(value).padStart(2, '0');

/**
 * The date of every message header in `text`, as DD-MM-YYYY, in order.
 *
 * Phones write the date their own way: day first in India, month first on a
 * US phone. Day first is used unless some header can only be read month first
 * (its second number is above 12) and none can only be read day first.
 */
function readMessageDates(text) {
    const parts = [];
    (text || '').split('\n').forEach(line => {
        const match = line.replace(/^[\s‎‏﻿]+/, '').match(MESSAGE_DATE_REGEX);
        if (match) parts.push([Number(match[1]), Number(match[2]), match[3]]);
    });
    const monthFirst = parts.some(([, second]) => second > 12) && !parts.some(([first]) => first > 12);
    return parts.map(([first, second, year]) => {
        const day = monthFirst ? second : first;
        const month = monthFirst ? first : second;
        return padDatePart(day) + '-' + padDatePart(month) + '-' + (year.length === 2 ? '20' + year : year);
    });
}

/**
 * The date to enter the messages under: the day most of them were sent, so a
 * late "ok" the next morning does not move the whole batch. A tie goes to the
 * later day. `dates` lists every day found, oldest first, with its count.
 */
function pickEntryDate(text) {
    const counts = new Map();
    readMessageDates(text).forEach(date => counts.set(date, (counts.get(date) || 0) + 1));
    const byDay = date => date.split('-').reverse().join('');
    const dates = [...counts.keys()].sort((a, b) => byDay(a).localeCompare(byDay(b)));
    let date = '';
    dates.forEach(day => {
        if (!date || counts.get(day) >= counts.get(date)) date = day;
    });
    return { date: date, dates: dates.map(day => ({ date: day, messages: counts.get(day) })) };
}

// A real calendar date written DD-MM-YYYY, the way the site's date box holds it.
function isValidEntryDate(value) {
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) return false;
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Sets the entry date box from the messages now in the input. A date typed
 * over the one read from the messages is kept until the messages give a
 * different day.
 */
function refreshEntryDate() {
    const field = document.getElementById(ENTRY_DATE_FIELD_ID);
    const input = document.getElementById(INPUT_FIELD_ID);
    if (!field || !input) return;

    const found = pickEntryDate(input.value);
    const previous = field.dataset.fromMessages || '';
    if (!field.value || field.value === previous || found.date !== previous) {
        field.value = found.date;
    }
    field.dataset.fromMessages = found.date;
    field.classList.toggle('mixed-dates', found.dates.length > 1);
    field.title = found.dates.length > 0
        ? 'Dates in the messages: ' + found.dates.map(day => `${day.date} (${day.messages})`).join(', ')
        : 'No message dates found. The site keeps its own date unless one is typed here.';
}

// New content from a zip brings its own date; nothing typed for the last one carries over.
function resetEntryDate() {
    const field = document.getElementById(ENTRY_DATE_FIELD_ID);
    if (!field) return;
    field.value = '';
    delete field.dataset.fromMessages;
}

/**
 * The date to send with a fill: empty to leave the site's date alone, or null
 * (after saying why) when what is typed is not a real DD-MM-YYYY date.
 */
function readEntryDateForFill() {
    const value = (document.getElementById(ENTRY_DATE_FIELD_ID)?.value || '').trim();
    if (value && !isValidEntryDate(value)) {
        alert('Entry date must be a real date written DD-MM-YYYY, e.g. 10-09-2026. Clear it to keep the date the site shows.');
        return null;
    }
    return value;
}
