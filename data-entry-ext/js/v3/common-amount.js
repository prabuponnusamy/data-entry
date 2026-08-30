
// Optional "use this amount for every entry" override, set on the Parse Data
// page. Left blank it changes nothing - the amount still comes from whatever
// the message said, group by group.
//
// It exists because an amount typed once at the top of a message only reaches
// the first group of numbers: groupCleanedUpDataSecondLevel deliberately keeps
// a stray "RS 30" with the numbers it sits next to, and a BOX/TKT flip or a
// digit-length change starts a new group that has no amount of its own.
//
//   missing (default) - fill only the entries that ended up without an amount,
//                       so an "RS 60" typed against one block still wins.
//   all               - every 3D/4D/5D entry gets the common amount.
//
// 1D/2D rows are untouched either way: they carry a target, not an amount.

function getCommonAmount() {
    const value = (document.getElementById(COMMON_AMOUNT_FIELD_ID)?.value || '').trim();
    if (!/^\d+$/.test(value)) {
        return { value: '', overrideAll: false };
    }
    const mode = (document.getElementById(COMMON_AMOUNT_MODE_FIELD_ID)?.value || '').trim();
    return { value: value, overrideAll: mode === 'all' };
}

// The amount an output row should carry, given the one the message produced.
function applyCommonAmount(amount) {
    const common = getCommonAmount();
    if (common.value && (common.overrideAll || !amount)) {
        return common.value;
    }
    return amount;
}
